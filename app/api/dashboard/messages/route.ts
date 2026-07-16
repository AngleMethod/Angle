import { NextRequest, NextResponse } from 'next/server'
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

function toClientMessage(row: MessageRow) {
  return {
    id: row.id,
    senderRole: row.sender_role,
    senderEmail: row.sender_email,
    body: row.body,
    createdAt: row.created_at,
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

  return NextResponse.json({ message: toClientMessage(data as MessageRow) })
}
