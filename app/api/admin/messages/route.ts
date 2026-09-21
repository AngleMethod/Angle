import { renderAngleEmail } from '@/lib/email'
import { after, NextRequest, NextResponse } from 'next/server'
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
const REPLY_TO_EMAIL = 'josh@angle.coach'
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

  return renderAngleEmail({eyebrow: 'A message from your coach', title: 'Let’s keep', accent: 'you moving.', descriptionHtml: 'Your coach replied in your Angle dashboard.', bodyHtml: escaped, actionLabel: 'Open dashboard', actionUrl: DASHBOARD_URL})
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

    return NextResponse.json({
      messages: ((data ?? []) as MessageRow[]).map(row => ({ ...toClientMessage(row), unread: row.sender_role === 'user' && !row.read_by_admin_at })),
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

  const payload = (await req.json().catch(() => null)) ?? ({} as PostBody)
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

  after(async () => {
    try { await sendReplyEmail(userEmail, body) }
    catch (error) { console.error('[messages] Notification failed after message was saved:', error) }
  })

  return NextResponse.json({
    message: toClientMessage(data as MessageRow),
    email: { queued: true },
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthedAdminReviewUser(req)
  if ('response' in auth) return auth.response
  const payload = (await req.json().catch(() => null)) ?? {}
  const ids = Array.isArray(payload.ids) ? payload.ids.filter((id: unknown) => typeof id === 'string').slice(0, 1000) : []
  if (typeof payload.userId !== 'string' || !payload.userId || !ids.length) return NextResponse.json({ error: 'A conversation and message IDs are required' }, { status: 400 })
  const { error } = await createAdminClient().from('coach_messages').update({ read_by_admin_at: new Date().toISOString() }).eq('user_id', payload.userId).eq('sender_role', 'user').is('read_by_admin_at', null).in('id', ids)
  if (error) return NextResponse.json({ error: 'Could not update read status' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
