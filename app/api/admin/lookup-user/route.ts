import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient, findUserByEmail } from '@/lib/supabase'

const ADMIN_EMAILS = [
  'josh@anglemethod.com',
  'morgan@anglemethod.com',
]

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return !!user?.email && ADMIN_EMAILS.includes(user.email)
}

export async function POST(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const { email: rawEmail } = await req.json()
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : ''
  if (!email) {
    return NextResponse.json({ error: 'Email required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const user = await findUserByEmail(admin, email)

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('onboarding_status')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    userId: user.id,
    onboardingStatus: subscription?.onboarding_status ?? 'not_booked',
  })
}
