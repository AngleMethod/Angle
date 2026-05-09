import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  describeError,
  getAuthedAdminReviewUser,
  getMuxClient,
  signReviewPlaybackTokens,
} from '@/app/api/dashboard/reviews/shared'

type AdminReviewStatus = 'uploading' | 'processing' | 'submitted' | 'reviewed' | 'error'

type AdminReviewRow = {
  id: string
  user_id: string
  user_email: string
  note: string
  status: AdminReviewStatus
  mux_playback_id: string | null
  duration_seconds: number | null
  file_name: string | null
  file_size_bytes: number | null
  mime_type: string | null
  submitted_at: string | null
  coach_note: string | null
  reviewed_by_email: string | null
  reviewed_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

type ReviewRequestBody = {
  submissionId?: unknown
  coachNote?: unknown
}

const DELETABLE_STATUSES: AdminReviewStatus[] = ['submitted', 'reviewed', 'error']

function isPlayableStatus(status: AdminReviewRow['status']) {
  return status === 'submitted' || status === 'reviewed'
}

function isDeletableStatus(status: AdminReviewStatus) {
  return DELETABLE_STATUSES.includes(status)
}

function isMuxNotFoundError(err: unknown) {
  if (!err || typeof err !== 'object') return false

  const maybeStatus = err as { status?: unknown; statusCode?: unknown; code?: unknown; message?: unknown }
  return maybeStatus.status === 404
    || maybeStatus.statusCode === 404
    || maybeStatus.code === 404
    || (typeof maybeStatus.message === 'string' && maybeStatus.message.includes('404'))
}

export async function GET(req: NextRequest) {
  const auth = await getAuthedAdminReviewUser(req)
  if ('response' in auth) return auth.response

  const userId = req.nextUrl.searchParams.get('userId')?.trim() ?? ''
  const rawLimit = Number(req.nextUrl.searchParams.get('limit') ?? (userId ? 5 : 100))
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
    : userId
      ? 5
      : 100

  const admin = createAdminClient()
  let query = admin
    .from('coach_review_submissions')
    .select('id, user_id, user_email, note, status, mux_playback_id, duration_seconds, file_name, file_size_bytes, mime_type, submitted_at, coach_note, reviewed_by_email, reviewed_at, error_message, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) {
    query = query.eq('user_id', userId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[admin/reviews GET] Failed to list submissions:', error)
    return NextResponse.json({ error: 'Failed to list review submissions' }, { status: 500 })
  }

  try {
    const submissions = await Promise.all(((data ?? []) as AdminReviewRow[]).map(async (row) => {
      const canPlay = !!row.mux_playback_id && isPlayableStatus(row.status)
      const tokens = canPlay ? await signReviewPlaybackTokens(row.mux_playback_id as string) : null

      return {
        id: row.id,
        userId: row.user_id,
        userEmail: row.user_email,
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
        reviewedByEmail: row.reviewed_by_email,
        reviewedAt: row.reviewed_at,
        errorMessage: row.error_message,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }
    }))

    return NextResponse.json({ submissions })
  } catch (err) {
    console.error('[admin/reviews GET] Failed to sign playback tokens:', describeError(err))
    return NextResponse.json({ error: 'Failed to prepare review videos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedAdminReviewUser(req)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({} as ReviewRequestBody))
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''
  const coachNote = typeof body.coachNote === 'string' ? body.coachNote.trim() : ''

  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }

  if (!coachNote) {
    return NextResponse.json({ error: 'Coach note is required' }, { status: 400 })
  }

  if (coachNote.length > 4000) {
    return NextResponse.json({ error: 'Coach note must be 4000 characters or fewer' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing, error: existingErr } = await admin
    .from('coach_review_submissions')
    .select('id, status, mux_playback_id')
    .eq('id', submissionId)
    .single()

  if (existingErr || !existing) {
    return NextResponse.json({ error: 'Review submission not found' }, { status: 404 })
  }

  if (!existing.mux_playback_id || !isPlayableStatus(existing.status as AdminReviewRow['status'])) {
    return NextResponse.json({ error: 'Review video is not ready yet' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const { data: updated, error: updateErr } = await admin
    .from('coach_review_submissions')
    .update({
      status: 'reviewed',
      coach_note: coachNote,
      reviewed_by_email: auth.user.email,
      reviewed_at: now,
      error_message: null,
    })
    .eq('id', submissionId)
    .select('id, status, coach_note, reviewed_by_email, reviewed_at')
    .single()

  if (updateErr || !updated) {
    console.error('[admin/reviews POST] Failed to save coach review:', updateErr)
    return NextResponse.json({ error: 'Failed to save coach review' }, { status: 500 })
  }

  return NextResponse.json({
    submission: {
      id: updated.id,
      status: updated.status,
      coachNote: updated.coach_note,
      reviewedByEmail: updated.reviewed_by_email,
      reviewedAt: updated.reviewed_at,
    },
  })
}

export async function DELETE(req: NextRequest) {
  const auth = await getAuthedAdminReviewUser(req)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({} as ReviewRequestBody))
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''

  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing, error: existingErr } = await admin
    .from('coach_review_submissions')
    .select('id, status, mux_asset_id')
    .eq('id', submissionId)
    .single()

  if (existingErr || !existing) {
    return NextResponse.json({ error: 'Review submission not found' }, { status: 404 })
  }

  const status = existing.status as AdminReviewStatus
  if (!isDeletableStatus(status)) {
    return NextResponse.json(
      { error: 'Wait until the video finishes processing before deleting it.' },
      { status: 400 }
    )
  }

  if (existing.mux_asset_id) {
    try {
      const mux = getMuxClient()
      await mux.video.assets.delete(existing.mux_asset_id)
    } catch (err) {
      if (isMuxNotFoundError(err)) {
        console.warn('[admin/reviews DELETE] Mux asset was already deleted:', existing.mux_asset_id)
      } else {
        console.error('[admin/reviews DELETE] Failed to delete Mux asset:', describeError(err))
        return NextResponse.json(
          { error: `Failed to delete video from Mux: ${describeError(err)}` },
          { status: 502 }
        )
      }
    }
  }

  const { error: deleteErr } = await admin
    .from('coach_review_submissions')
    .delete()
    .eq('id', submissionId)

  if (deleteErr) {
    console.error('[admin/reviews DELETE] Failed to delete submission row:', deleteErr)
    return NextResponse.json({ error: 'Failed to delete review submission' }, { status: 500 })
  }

  return NextResponse.json({ deleted: true })
}
