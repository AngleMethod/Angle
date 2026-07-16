import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase'
import { getAuthedAdminReviewUser } from '@/app/api/dashboard/reviews/shared'

type MessageRow = {
  id: string
  user_id: string
  user_email: string
  sender_role: 'user' | 'admin'
  sender_email: string
  body: string
  read_by_admin_at: string | null
  read_by_user_at: string | null
  created_at: string
}

type PostBody = {
  userId?: unknown
  body?: unknown
}

const FROM_EMAIL = 'Angle <hello@angle.coach>'
const REPLY_TO_EMAIL = 'josh@anglemethod.com'
const DASHBOARD_URL = 'https://angle.coach/dashboard'

function toClientMessage(row: MessageRow) {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    senderRole: row.sender_role,
    senderEmail: row.sender_email,
    body: row.body,
    createdAt: row.created_at,
  }
}

function buildReplyEmailHtml(message: string) {
  const escaped = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>New coach message - Angle</title>
  </head>
  <body style="margin:0;padding:0;background-color:#0a0a0a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;">
      <tr>
        <td align="center" style="padding:48px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr><td style="padding-bottom:32px;"><span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#666666;">Angle</span></td></tr>
            <tr><td style="padding-bottom:18px;"><h1 style="margin:0;font-size:32px;line-height:1.1;text-transform:uppercase;color:#ffffff;">New coach message</h1></td></tr>
            <tr><td style="padding-bottom:28px;"><p style="margin:0;font-size:15px;line-height:1.6;color:#aaaaaa;">Your coach replied in your Angle dashboard.</p></td></tr>
            <tr><td style="padding:20px;border:1px solid #1e1e1e;background:#111110;"><p style="margin:0;font-size:14px;line-height:1.7;color:#ffffff;">${escaped}</p></td></tr>
            <tr><td style="padding-top:32px;"><a href="${DASHBOARD_URL}" style="display:inline-block;background-color:#ffffff;color:#000000;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;padding:16px 32px;border-radius:4px;">Open Dashboard</a></td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function buildReplyEmailText(message: string) {
  return `New coach message from Angle:

${message}

Open your dashboard:
${DASHBOARD_URL}`
}

async function sendReplyEmail(toEmail: string, message: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[admin/messages] Reply email skipped: RESEND_API_KEY not set')
    return false
  }

  const resend = new Resend(apiKey)
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    replyTo: REPLY_TO_EMAIL,
    subject: 'New coach message - Angle',
    html: buildReplyEmailHtml(message),
    text: buildReplyEmailText(message),
  })

  if (error) {
    console.error('[admin/messages] Reply email failed:', error)
    return false
  }

  return true
}

async function markUserMessagesRead(userId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from('coach_messages')
    .update({ read_by_admin_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('sender_role', 'user')
    .is('read_by_admin_at', null)

  if (error) {
    console.error('[admin/messages] Failed to mark user messages read:', error)
  }
}

export async function GET(req: NextRequest) {
  const auth = await getAuthedAdminReviewUser(req)
  if ('response' in auth) return auth.response

  const userId = req.nextUrl.searchParams.get('userId')?.trim() ?? ''
  const admin = createAdminClient()

  if (userId) {
    const { data, error } = await admin
      .from('coach_messages')
      .select('id, user_id, user_email, sender_role, sender_email, body, read_by_admin_at, read_by_user_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[admin/messages GET] Failed to load thread:', error)
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
    }

    await markUserMessagesRead(userId)

    return NextResponse.json({
      messages: ((data ?? []) as MessageRow[]).map(toClientMessage),
    })
  }

  const { data, error } = await admin
    .from('coach_messages')
    .select('id, user_id, user_email, sender_role, sender_email, body, read_by_admin_at, read_by_user_at, created_at')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (error) {
    console.error('[admin/messages GET] Failed to load threads:', error)
    return NextResponse.json({ error: 'Failed to load message threads' }, { status: 500 })
  }

  const threads = new Map<string, {
    userId: string
    userEmail: string
    latestMessage: string
    latestAt: string
    unreadCount: number
  }>()

  for (const row of (data ?? []) as MessageRow[]) {
    const existing = threads.get(row.user_id)
    if (!existing) {
      threads.set(row.user_id, {
        userId: row.user_id,
        userEmail: row.user_email,
        latestMessage: row.body,
        latestAt: row.created_at,
        unreadCount: 0,
      })
    }

    if (row.sender_role === 'user' && !row.read_by_admin_at) {
      const thread = threads.get(row.user_id)
      if (thread) thread.unreadCount += 1
    }
  }

  return NextResponse.json({ threads: Array.from(threads.values()) })
}

export async function POST(req: NextRequest) {
  const auth = await getAuthedAdminReviewUser(req)
  if ('response' in auth) return auth.response

  const payload = await req.json().catch(() => ({} as PostBody))
  const userId = typeof payload.userId === 'string' ? payload.userId.trim() : ''
  const body = typeof payload.body === 'string' ? payload.body.trim() : ''

  if (!userId || !body) {
    return NextResponse.json({ error: 'userId and message are required' }, { status: 400 })
  }

  if (body.length > 4000) {
    return NextResponse.json({ error: 'Message must be 4000 characters or fewer' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: userResult, error: userErr } = await admin.auth.admin.getUserById(userId)
  const userEmail = userResult?.user?.email ?? null

  if (userErr || !userEmail) {
    console.error('[admin/messages POST] Failed to find recipient:', userErr)
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  }

  const { data, error } = await admin
    .from('coach_messages')
    .insert({
      user_id: userId,
      user_email: userEmail,
      sender_role: 'admin',
      sender_email: auth.user.email,
      body,
      read_by_admin_at: new Date().toISOString(),
    })
    .select('id, user_id, user_email, sender_role, sender_email, body, read_by_admin_at, read_by_user_at, created_at')
    .single()

  if (error || !data) {
    console.error('[admin/messages POST] Failed to save reply:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }

  const emailSent = await sendReplyEmail(userEmail, body)

  return NextResponse.json({
    message: toClientMessage(data as MessageRow),
    email: { attempted: true, sent: emailSent },
  })
}
