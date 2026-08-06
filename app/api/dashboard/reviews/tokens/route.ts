import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import {
  describeError,
  getActiveReviewUser,
  signReviewPlaybackTokens,
} from '../shared'

type TokenRequestBody = {
  submissionId?: unknown
}

type ReviewTokenRow = {
  id: string
  user_id: string
  status: 'uploading' | 'processing' | 'submitted' | 'reviewed' | 'error'
  mux_playback_id: string | null
}

function isViewableStatus(status: ReviewTokenRow['status']) {
  return status === 'submitted' || status === 'reviewed'
}

export async function POST(req: NextRequest) {
  const auth = await getActiveReviewUser(req)
  if ('response' in auth) return auth.response

  const body = await req.json().catch(() => ({} as TokenRequestBody))
  const submissionId = typeof body.submissionId === 'string' ? body.submissionId.trim() : ''

  if (!submissionId) {
    return NextResponse.json({ error: 'submissionId is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coach_review_submissions')
    .select('id, user_id, status, mux_playback_id')
    .eq('id', submissionId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Review submission not found' }, { status: 404 })
  }

  const submission = data as ReviewTokenRow
  if (!auth.user.isAdmin && submission.user_id !== auth.user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  if (!submission.mux_playback_id || !isViewableStatus(submission.status)) {
    return NextResponse.json({ error: 'Review video is not ready yet' }, { status: 400 })
  }

  try {
    const tokens = await signReviewPlaybackTokens(submission.mux_playback_id)
    return NextResponse.json({ tokens })
  } catch (err) {
    console.error('[dashboard/reviews/tokens POST] Failed to sign playback tokens:', describeError(err))
    return NextResponse.json({ error: 'Failed to refresh playback token' }, { status: 500 })
  }
}
