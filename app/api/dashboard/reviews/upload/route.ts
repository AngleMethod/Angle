import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  describeError,
  getActiveReviewUser,
  getMuxClient,
  isValidReviewMimeType,
  MAX_REVIEW_VIDEO_SIZE_BYTES,
} from '../shared'

type UploadRequestBody = {
  fileName?: unknown
  fileSizeBytes?: unknown
  mimeType?: unknown
}

export async function POST(req: NextRequest) {
  const auth = await getActiveReviewUser(req)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({} as UploadRequestBody))
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim().slice(0, 255) : null
  const mimeType = typeof body.mimeType === 'string' ? body.mimeType.trim().slice(0, 255) : null
  const fileSizeBytes = typeof body.fileSizeBytes === 'number' && Number.isFinite(body.fileSizeBytes)
    ? Number(body.fileSizeBytes)
    : null

  if (fileSizeBytes !== null && fileSizeBytes > MAX_REVIEW_VIDEO_SIZE_BYTES) {
    return NextResponse.json({ error: 'Video must be 500MB or smaller' }, { status: 400 })
  }

  if (!isValidReviewMimeType(mimeType)) {
    return NextResponse.json({ error: 'Upload must be a video file' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: submission, error: insertErr } = await admin
    .from('coach_review_submissions')
    .insert({
      user_id: auth.user.id,
      user_email: auth.user.email,
      status: 'uploading',
      file_name: fileName,
      file_size_bytes: fileSizeBytes,
      mime_type: mimeType,
    })
    .select('id')
    .single()

  if (insertErr || !submission) {
    console.error('[dashboard/reviews/upload POST] Failed to create submission:', insertErr)
    return NextResponse.json({ error: 'Failed to create review submission' }, { status: 500 })
  }

  try {
    const mux = getMuxClient()
    const upload = await mux.video.uploads.create({
      cors_origin: process.env.NEXT_PUBLIC_SITE_URL ?? '*',
      timeout: 60 * 60,
      new_asset_settings: {
        playback_policies: ['signed'],
        max_resolution_tier: '1080p',
        video_quality: 'basic',
        passthrough: submission.id,
      },
    })

    if (!upload.id || !upload.url) {
      throw new Error('Mux upload response was missing id or url')
    }

    const { error: updateErr } = await admin
      .from('coach_review_submissions')
      .update({
        mux_upload_id: upload.id,
        mux_processing_status: upload.status ?? null,
      })
      .eq('id', submission.id)

    if (updateErr) {
      console.error('[dashboard/reviews/upload POST] Failed to save Mux upload id:', updateErr)
      return NextResponse.json({ error: 'Failed to save upload metadata' }, { status: 500 })
    }

    return NextResponse.json({
      submissionId: submission.id,
      uploadId: upload.id,
      uploadUrl: upload.url,
      maxFileSizeBytes: MAX_REVIEW_VIDEO_SIZE_BYTES,
    })
  } catch (err) {
    const message = describeError(err)
    console.error('[dashboard/reviews/upload POST] Failed to create Mux upload:', message)
    await admin
      .from('coach_review_submissions')
      .update({ status: 'error', error_message: message })
      .eq('id', submission.id)

    return NextResponse.json(
      { error: `Failed to create upload: ${message}` },
      { status: 500 }
    )
  }
}
