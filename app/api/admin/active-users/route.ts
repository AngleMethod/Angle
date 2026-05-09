import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'

const ADMIN_EMAILS = [
  'josh@anglemethod.com',
  'morgan@anglemethod.com',
]

type SubscriptionRow = {
  user_id: string | null
  onboarding_status: string | null
}

async function isAdmin(req: NextRequest): Promise<boolean> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return !!user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
}

export async function GET(req: NextRequest) {
  if (!await isAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: subscriptions, error } = await admin
    .from('subscriptions')
    .select('user_id, onboarding_status')
    .eq('status', 'active')

  if (error) {
    console.error('[active-users GET] Failed to load subscriptions:', error)
    return NextResponse.json({ error: 'Failed to load active users' }, { status: 500 })
  }

  const subscriptionRows = (subscriptions ?? []) as SubscriptionRow[]
  const activeById = new Map(
    subscriptionRows
      .filter(row => !!row.user_id)
      .map(row => [row.user_id as string, row.onboarding_status ?? 'not_booked'])
  )

  const users: Array<{ userId: string; email: string; onboardingStatus: string }> = []
  const perPage = 1000

  for (let page = 1; ; page++) {
    const { data, error: usersError } = await admin.auth.admin.listUsers({ page, perPage })
    if (usersError) {
      console.error('[active-users GET] Failed to load auth users:', usersError)
      return NextResponse.json({ error: 'Failed to load active users' }, { status: 500 })
    }

    for (const user of data?.users ?? []) {
      const email = user.email?.toLowerCase()
      const isHardcodedAdmin = !!email && ADMIN_EMAILS.includes(email)
      const onboardingStatus = activeById.get(user.id) ?? (isHardcodedAdmin ? 'completed' : null)
      if (onboardingStatus && user.email) {
        users.push({
          userId: user.id,
          email: user.email,
          onboardingStatus,
        })
      }
    }

    if (!data?.users || data.users.length < perPage) break
  }

  users.sort((a, b) => a.email.localeCompare(b.email))

  return NextResponse.json({ users })
}
