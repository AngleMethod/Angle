import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'
import {
  describeError,
  getActiveReviewUser,
  getMuxClient,
  MAX_REVIEW_VIDEO_DURATION_SECONDS,
  signReviewPlaybackTokens,
} from './shared'

type ReviewSubmissionRow = {
  id: string
  user_id: string
  user_email: string
  note: string
  status: 'uploading' | 'processing' | 'submitted' | 'reviewed' | 'error'
  mux_upload_id: string | null
  mux_asset_id: string | null
  mux_playback_id: string | null
  mux_processing_status: string | null
  duration_seconds: number | null
  file_name: string | null
  file_size_bytes: number | null
  mime_type: string | null
  submitted_at: string | null
  coach_note: string | null
  reviewed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

type SubmitRequestBody = {
  submissionId?: unknown
  uploadId?: unknown
  note?: unknown
}

type ResolveOk = {
  kind: 'ok'
  uploadStatus: string | null
  assetId: string
  playbackId: string
  assetStatus: string | null
  duration: number | null
}
type ResolvePending = { kind: 'pending'; uploadStatus: string | null; assetId?: string | null; assetStatus?: string | null }
type ResolveError = { kind: 'error'; message: string; uploadStatus: string | null; assetId?: string | null; assetStatus?: string | null }
type ResolveResult = ResolveOk | ResolvePending | ResolveError

const FROM_EMAIL = 'Angle <hello@angle.coach>'
const ADMIN_NOTIFICATION_EMAIL = 'josh@anglemethod.com'
const ADMIN_REVIEWS_URL = 'https://angle.coach/admin/reviews'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
}

function buildReviewUploadEmailHtml({
  userEmail,
  note,
  durationSeconds,
}: {
  userEmail: string
  note: string
  durationSeconds: number | null
}) {
  const duration = durationSeconds ? `${durationSeconds}s` : 'Unknown'

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New review video - Angle</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr><td style="padding-bottom:32px;"><span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#666666;">Angle</span></td></tr>
            <tr><td style="padding-bottom:18px;"><h1 style="margin:0;font-size:32px;line-height:1.1;text-transform:uppercase;color:#ffffff;">New review video</h1></td></tr>
            <tr><td style="padding-bottom:16px;"><p style="margin:0;font-size:15px;line-height:1.6;color:#aaaaaa;">${escapeHtml(userEmail)} uploaded a progress video.</p></td></tr>
            <tr><td style="padding:20px;border:1px solid #1e1e1e;background:#111110;">
              <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#aaaaaa;">Duration: <strong style="color:#ffffff;">${escapeHtml(duration)}</strong></p>
              ${note ? `<p style="margin:0;font-size:14px;line-height:1.7;color:#ffffff;">${escapeHtml(note)}</p>` : '<p style="margin:0;font-size:14px;line-height:1.7;color:#777777;">No note added.</p>'}
            </td></tr>
            <tr><td style="padding-top:32px;"><a href="${ADMIN_REVIEWS_URL}" style="display:inline-block;background-color:#ffffff;color:#000000;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:16px 32px;border-radius:4px;">Open Reviews</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildReviewUploadEmailText({
  userEmail,
  note,
  durationSeconds,
}: {
  userEmail: string
  note: string
  durationSeconds: number | null
}) {
  return `New review video from ${userEmail}

Duration: ${durationSeconds ? `${durationSeconds}s` : 'Unknown'}
${note ? `Note:\n${note}\n` : 'No note added.\n'}
Open reviews:
${ADMIN_REVIEWS_URL}`
}

async function sendReviewUploadEmail({
  submissionId,
  userEmail,
  note,
  durationSeconds,
}: {
  submissionId: string
  userEmail: string
  note: string
  durationSeconds: number | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[dashboard/reviews POST] Review upload email skipped: RESEND_API_KEY not set')
    return false
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: ADMIN_NOTIFICATION_EMAIL,
        replyTo: userEmail,
        subject: `New review video from ${userEmail}`,
        html: buildReviewUploadEmailHtml({ userEmail, note, durationSeconds }),
        text: buildReviewUploadEmailText({ userEmail, note, durationSeconds }),
      },
      {
        headers: {
          'Idempotency-Key': `review-upload-${submissionId}`,
        },
      }
    )

    if (error) {
      console.error('[dashboard/reviews POST] Review upload email failed:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[dashboard/reviews POST] Review upload email threw:', err)
    return false
  }
}

function isViewableStatus(status: ReviewSubmissionRow['status']) {
  return status === 'submitted' || status === 'reviewed'
}

async function resolveAssetFromUpload(uploadId: string): Promise<ResolveResult> {
  const mux = getMuxClient()

  for (let attempt = 0; attempt < 15; attempt++) {
    const upload = await mux.video.uploads.retrieve(uploadId)
    const uploadStatus = upload.status ?? null

    if (upload.error) {
      return {
        kind: 'error',
        message: upload.error.message ?? 'Mux upload failed',
        uploadStatus,
        assetId: upload.asset_id ?? null,
      }
    }

    if (upload.asset_id) {
      const asset = await mux.video.assets.retrieve(upload.asset_id)
      const assetStatus = asset.status ?? null

      if (asset.errors?.messages?.length) {
        return {
          kind: 'error',
          message: asset.errors.messages.join(', '),
          uploadStatus,
          assetId: asset.id,
          assetStatus,
        }
      }

      const playback = asset.playback_ids?.find(p => p.policy === 'signed')
      if (asset.status === 'ready' && playback) {
        return {
          kind: 'ok',
          uploadStatus,
          assetId: asset.id,
          playbackId: playback.id,
          assetStatus,
          duration: asset.duration ? Math.round(asset.duration) : null,
        }
      }

      return {
        kind: 'pending',
        uploadStatus,
        assetId: asset.id,
        assetStatus,
      }
    }

    await new Promise(r => setTimeout(r, 1000))
  }

  return { kind: 'pending', uploadStatus: null }
}

export async function GET(req: NextRequest) {
  const auth = await getActiveReviewUser(req)
  if ('response' in auth) return auth.response

  const { searchParams } = new URL(req.url)
  const requestedLimit = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const limit = Number.isFinite(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 25)
    : null

  const admin = createAdminClient()
  let query = admin
    .from('coach_review_submissions')
    .select('id, user_id, user_email, note, status, mux_upload_id, mux_asset_id, mux_playback_id, mux_processing_status, duration_seconds, file_name, file_size_bytes, mime_type, submitted_at, coach_note, reviewed_at, error_message, created_at, updated_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: false })

  if (limit !== null) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('[dashboard/reviews GET] Failed to list submissions:', error)
    return NextResponse.json({ error: 'Failed to list review submissions' }, { status: 500 })
  }

  try {
    const submissions = await Promise.all(((data ?? []) as ReviewSubmissionRow[]).map(async (row) => {
      const canPlay = !!row.mux_playback_id && isViewableStatus(row.status)
      const tokens = canPlay ? await signReviewPlaybackTokens(row.mux_playback_id as string) : null

      return {
        id: row.id,
        note: row.note,
        status: row.status,
        playbackId: row.mux_playback_id,
        playbackTokens: tokens,
        durationSeconds: row.duration_seconds,
        fileName: row.file_name,
        fileSizeBytes: row.file_size_bytes,
        mimeType: row.mime_type,
        submittedAt: row.submitted_at,
        coachNote: row.coach_note,
        reviewedAt: row.reviewed_at,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    }))

    return NextResponse.json({ submissions })
  } catch (err) {
    console.error('[dashboard/reviews GET] Failed to sign playback tokens:', describeError(err))
    return NextResponse.json({ error: 'Failed to prepare review videos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getActiveReviewUser(req)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({} as SubmitRequestBody))
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
  const uploadId = typeof body.uploadId === 'string' ? body.uploadId.trim() : ''
  const note = typeof body.note === 'string' ? body.note.trim() : ''

  if (!submissionId || !uploadId) {
    return NextResponse.json({ error: 'submissionId and uploadId are required' }, { status: 400 })
  }

  if (note.length > 2000) {
    return NextResponse.json({ error: 'Note must be 2000 characters or fewer' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing, error: existingErr } = await admin
    .from('coach_review_submissions')
    .select('id, user_id, mux_upload_id, status')
    .eq('id', submissionId)
    .single()

  if (existingErr || !existing) {
    return NextResponse.json({ error: 'Review submission not found' }, { status: 404 })
  }

  if (!auth.user.isAdmin && existing.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (existing.mux_upload_id && existing.mux_upload_id !== uploadId) {
    return NextResponse.json({ error: 'Upload does not match submission' }, { status: 400 })
  }

  try {
    const resolved = await resolveAssetFromUpload(uploadId)

    if (resolved.kind === 'pending') {
      await admin
        .from('coach_review_submissions')
        .update({
          status: 'processing',
          note,
          mux_processing_status: resolved.assetStatus ?? resolved.uploadStatus,
          mux_asset_id: resolved.assetId ?? null,
        })
        .eq('id', submissionId)

      return NextResponse.json(
        { error: 'Mux is still processing. Try again shortly.', status: 'processing' },
        { status: 409 }
      )
    }

    if (resolved.kind === 'error') {
      await admin
        .from('coach_review_submissions')
        .update({
          status: 'error',
          note,
          mux_processing_status: resolved.assetStatus ?? resolved.uploadStatus,
          mux_asset_id: resolved.assetId ?? null,
          error_message: resolved.message,
        })
        .eq('id', submissionId)

      return NextResponse.json({ error: resolved.message }, { status: 502 })
    }

    if (resolved.duration !== null && resolved.duration > MAX_REVIEW_VIDEO_DURATION_SECONDS) {
      const mux = getMuxClient()
      try {
        await mux.video.assets.delete(resolved.assetId)
      } catch (err) {
        console.error('[dashboard/reviews POST] Failed to delete over-limit asset:', describeError(err))
      }

      await admin
        .from('coach_review_submissions')
        .update({
          status: 'error',
          note,
          mux_upload_id: uploadId,
          mux_asset_id: resolved.assetId,
          mux_playback_id: resolved.playbackId,
          mux_processing_status: resolved.assetStatus,
          duration_seconds: resolved.duration,
          error_message: 'Video must be 2 minutes or shorter',
        })
        .eq('id', submissionId)

      return NextResponse.json({ error: 'Video must be 2 minutes or shorter' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const { count: pendingReviewCount, error: pendingReviewErr } = await admin
      .from('coach_review_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', auth.user.id)
      .eq('status', 'submitted')
      .neq('id', submissionId)

    if (pendingReviewErr) {
      console.error('[dashboard/reviews POST] Failed to check pending review count:', pendingReviewErr)
    }

    const shouldEmailCoach = !pendingReviewErr && (pendingReviewCount ?? 0) === 0
    const { data: updated, error: updateErr } = await admin
      .from('coach_review_submissions')
      .update({
        status: 'submitted',
        note,
        mux_upload_id: uploadId,
        mux_asset_id: resolved.assetId,
        mux_playback_id: resolved.playbackId,
        mux_processing_status: resolved.assetStatus,
        duration_seconds: resolved.duration,
        submitted_at: now,
        error_message: null,
      })
      .eq('id', submissionId)
      .select('id, status, mux_playback_id, duration_seconds, submitted_at')
      .single()

    if (updateErr || !updated) {
      console.error('[dashboard/reviews POST] Failed to save submitted review:', updateErr)
      return NextResponse.json({ error: 'Failed to save review submission' }, { status: 500 })
    }

    if (shouldEmailCoach) {
      await sendReviewUploadEmail({
        submissionId: updated.id,
        userEmail: auth.user.email,
        note,
        durationSeconds: updated.duration_seconds,
      })
    }

    return NextResponse.json({
      submission: {
        id: updated.id,
        status: updated.status,
        playbackId: updated.mux_playback_id,
        durationSeconds: updated.duration_seconds,
        submittedAt: updated.submitted_at,
      },
    })
  } catch (err) {
    const message = describeError(err)
    console.error('[dashboard/reviews POST] Failed to resolve review upload:', message)
    return NextResponse.json({ error: `Failed to process review upload: ${message}` }, { status: 500 })
  }
}
