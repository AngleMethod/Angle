import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
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

const FROM_EMAIL = 'Angle <hello@angle.coach>'
const REPLY_TO_EMAIL = 'josh@anglemethod.com'
const DASHBOARD_URL = 'https://angle.coach/dashboard'
const DELETABLE_STATUSES: AdminReviewStatus[] = ['uploading', 'processing', 'submitted', 'reviewed', 'error']

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
}

function buildFeedbackReadyEmailHtml(coachNote: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Your video feedback is ready - Angle</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr><td style="padding-bottom:32px;"><span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#666666;">Angle</span></td></tr>
            <tr><td style="padding-bottom:18px;"><h1 style="margin:0;font-size:32px;line-height:1.1;text-transform:uppercase;color:#ffffff;">Your video feedback is ready</h1></td></tr>
            <tr><td style="padding-bottom:16px;"><p style="margin:0;font-size:15px;line-height:1.6;color:#aaaaaa;">Your coach reviewed your progress video. Open your dashboard to watch it back and reply.</p></td></tr>
            <tr><td style="padding:20px;border:1px solid #1e1e1e;background:#111110;">
              ${coachNote ? `<p style="margin:0;font-size:14px;line-height:1.7;color:#ffffff;">${escapeHtml(coachNote)}</p>` : '<p style="margin:0;font-size:14px;line-height:1.7;color:#777777;">No written note added.</p>'}
            </td></tr>
            <tr><td style="padding-top:32px;"><a href="${DASHBOARD_URL}" style="display:inline-block;background-color:#ffffff;color:#000000;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:16px 32px;border-radius:4px;">Open Dashboard</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildFeedbackReadyEmailText(coachNote: string) {
  return `Your video feedback is ready.

Your coach reviewed your progress video. Open your dashboard to watch it back and reply.

${coachNote ? `Coach note:\n${coachNote}\n\n` : 'No written note added.\n\n'}Open your dashboard:
${DASHBOARD_URL}`
}

async function sendFeedbackReadyEmail({
  toEmail,
  coachNote,
  submissionId,
  reviewedAt,
}: {
  toEmail: string
  coachNote: string
  submissionId: string
  reviewedAt: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[admin/reviews POST] Feedback-ready email skipped: RESEND_API_KEY not set')
    return false
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: toEmail,
        replyTo: REPLY_TO_EMAIL,
        subject: 'Your video feedback is ready - Angle',
        html: buildFeedbackReadyEmailHtml(coachNote),
        text: buildFeedbackReadyEmailText(coachNote),
      },
      {
        headers: {
          'Idempotency-Key': `review-feedback-${submissionId}-${reviewedAt}`,
        },
      }
    )

    if (error) {
      console.error('[admin/reviews POST] Feedback-ready email failed:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[admin/reviews POST] Feedback-ready email threw:', err)
    return false
  }
}

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

function isMuxUploadAlreadyCompletedError(err: unknown) {
  const message = describeError(err).toLowerCase()
  return message.includes('upload has already completed')
    || (message.includes('already completed') && message.includes('upload'))
}

async function deleteMuxAsset(assetId: string): Promise<NextResponse | null> {
  try {
    const mux = getMuxClient()
    await mux.video.assets.delete(assetId)
  } catch (err) {
    if (isMuxNotFoundError(err)) {
      console.warn('[admin/reviews DELETE] Mux asset was already deleted:', assetId)
      return null
    }

    console.error('[admin/reviews DELETE] Failed to delete Mux asset:', describeError(err))
    return NextResponse.json(
      { error: `Failed to delete video from Mux: ${describeError(err)}` },
      { status: 502 }
    )
  }

  return null
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

  if (coachNote.length > 4000) {
    return NextResponse.json({ error: 'Coach note must be 4000 characters or fewer' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: existing, error: existingErr } = await admin
    .from('coach_review_submissions')
    .select('id, user_email, status, mux_playback_id')
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
      coach_note: coachNote || null,
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

  const emailSent = coachNote
    ? await sendFeedbackReadyEmail({
      toEmail: existing.user_email,
      coachNote,
      submissionId: updated.id,
      reviewedAt: updated.reviewed_at,
    })
    : false

  return NextResponse.json({
    submission: {
      id: updated.id,
      status: updated.status,
      coachNote: updated.coach_note,
      reviewedByEmail: updated.reviewed_by_email,
      reviewedAt: updated.reviewed_at,
    },
    email: { attempted: !!coachNote, sent: emailSent },
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
    .select('id, status, mux_upload_id, mux_asset_id')
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

  let muxAssetId = existing.mux_asset_id as string | null

  if (muxAssetId) {
    const assetDeleteResponse = await deleteMuxAsset(muxAssetId)
    if (assetDeleteResponse) return assetDeleteResponse
  } else if (existing.mux_upload_id) {
    try {
      const mux = getMuxClient()
      await mux.video.uploads.cancel(existing.mux_upload_id)
    } catch (err) {
      if (isMuxNotFoundError(err)) {
        console.warn('[admin/reviews DELETE] Mux upload was already gone:', existing.mux_upload_id)
      } else if (isMuxUploadAlreadyCompletedError(err)) {
        console.warn('[admin/reviews DELETE] Mux upload already completed, resolving asset before row delete:', existing.mux_upload_id)

        try {
          const mux = getMuxClient()
          const upload = await mux.video.uploads.retrieve(existing.mux_upload_id)
          muxAssetId = upload.asset_id ?? null
        } catch (retrieveErr) {
          if (isMuxNotFoundError(retrieveErr)) {
            console.warn('[admin/reviews DELETE] Mux upload was already gone after completed response:', existing.mux_upload_id)
          } else {
            console.warn('[admin/reviews DELETE] Could not resolve completed Mux upload asset:', {
              uploadId: existing.mux_upload_id,
              error: describeError(retrieveErr),
            })
          }
        }

        if (muxAssetId) {
          const assetDeleteResponse = await deleteMuxAsset(muxAssetId)
          if (assetDeleteResponse) return assetDeleteResponse
        }
      } else {
        console.error('[admin/reviews DELETE] Failed to cancel Mux upload:', describeError(err))
        return NextResponse.json(
          { error: `Failed to cancel video upload in Mux: ${describeError(err)}` },
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
