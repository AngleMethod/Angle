import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAIL = 'josh@notecreativestudios.com'
const VALID_STATUSES = ['not_booked', 'booked', 'completed']

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.email === ADMIN_EMAIL
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { userId, status } = await req.json()
  if (!userId || !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: 'userId and valid status required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('subscriptions')
    .update({ onboarding_status: status })
    .eq('user_id', userId)

  if (error) {
    console.error('Failed to update onboarding status:', error)
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
