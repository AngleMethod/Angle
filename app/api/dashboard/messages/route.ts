import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'
import { getActiveReviewUser } from '@/app/api/dashboard/reviews/shared'

type MessageRow = {
  id: string
  user_id: string
  user_email: string
  sender_role: 'user' | 'admin'
  sender_email: string
  body: string
  read_by_user_at: string | null
  created_at: string
}

type MessageBody = {
  body?: unknown
}

const FROM_EMAIL = 'Angle <hello@angle.coach>'
const ADMIN_NOTIFICATION_EMAIL = 'josh@anglemethod.com'
const ADMIN_URL = 'https://angle.coach/admin'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')
}

function toClientMessage(row: MessageRow) {
  return {
    id: row.id,
    senderRole: row.sender_role,
    senderEmail: row.sender_email,
    body: row.body,
    createdAt: row.created_at,
  }
}

function buildClientMessageEmailHtml(row: MessageRow) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New client message - Angle</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr><td style="padding-bottom:32px;"><span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#666666;">Angle</span></td></tr>
            <tr><td style="padding-bottom:18px;"><h1 style="margin:0;font-size:32px;line-height:1.1;text-transform:uppercase;color:#ffffff;">New client message</h1></td></tr>
            <tr><td style="padding-bottom:16px;"><p style="margin:0;font-size:15px;line-height:1.6;color:#aaaaaa;">${escapeHtml(row.user_email)} sent you a message in Angle.</p></td></tr>
            <tr><td style="padding:20px;border:1px solid #1e1e1e;background:#111110;"><p style="margin:0;font-size:14px;line-height:1.7;color:#ffffff;">${escapeHtml(row.body)}</p></td></tr>
            <tr><td style="padding-top:32px;"><a href="${ADMIN_URL}" style="display:inline-block;background-color:#ffffff;color:#000000;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:16px 32px;border-radius:4px;">Open Admin</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildClientMessageEmailText(row: MessageRow) {
  return `New client message from ${row.user_email}:

${row.body}

Open admin:
${ADMIN_URL}`
}

async function sendClientMessageEmail(row: MessageRow) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[dashboard/messages] Client message email skipped: RESEND_API_KEY not set')
    return false
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: ADMIN_NOTIFICATION_EMAIL,
        replyTo: row.user_email,
        subject: `New client message from ${row.user_email}`,
        html: buildClientMessageEmailHtml(row),
        text: buildClientMessageEmailText(row),
      },
      {
        headers: {
          'Idempotency-Key': `client-message-${row.id}`,
        },
      }
    )

    if (error) {
      console.error('[dashboard/messages] Client message email failed:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('[dashboard/messages] Client message email threw:', err)
    return false
  }
}

async function markAdminRepliesRead(userId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('coach_messages')
    .update({ read_by_user_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('sender_role', 'admin')
    .is('read_by_user_at', null)

  if (error) {
    console.error('[dashboard/messages] Failed to mark admin replies read:', error)
  }
}

export async function GET(req: NextRequest) {
  const auth = await getActiveReviewUser(req)
  if ('response' in auth) return auth.response

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coach_messages')
    .select('id, user_id, user_email, sender_role, sender_email, body, read_by_user_at, created_at')
    .eq('user_id', auth.user.id)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[dashboard/messages GET] Failed to load messages:', error)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }

  await markAdminRepliesRead(auth.user.id)

  return NextResponse.json({
    messages: ((data ?? []) as MessageRow[]).map(toClientMessage),
  })
}

export async function POST(req: NextRequest) {
  const auth = await getActiveReviewUser(req)
  if ('response' in auth) return auth.response

  const payload = await req.json().catch(() => ({} as MessageBody))
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''

  if (!body) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 })
  }

  if (body.length > 4000) {
    return NextResponse.json({ error: 'Message must be 4000 characters or fewer' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coach_messages')
    .insert({
      user_id: auth.user.id,
      user_email: auth.user.email,
      sender_role: 'user',
      sender_email: auth.user.email,
      body,
      read_by_user_at: new Date().toISOString(),
    })
    .select('id, user_id, user_email, sender_role, sender_email, body, read_by_user_at, created_at')
    .single()

  if (error || !data) {
    console.error('[dashboard/messages POST] Failed to save message:', error)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  const message = data as MessageRow
  const emailSent = await sendClientMessageEmail(message)

  return NextResponse.json({
    message: toClientMessage(message),
    email: { attempted: true, sent: emailSent },
  })
}
