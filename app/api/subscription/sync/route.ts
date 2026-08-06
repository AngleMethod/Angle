import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase'
import { reconcileStripeSubscriptionAccess } from '@/lib/stripeSubscriptionAccess'

const ADMIN_EMAILS = [
  'josh@anglemethod.com',
  'morgan@anglemethod.com',
  'ninagrishchenko2003@gmail.com',
]

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = user.email?.trim().toLowerCase() ?? null
  if (email && ADMIN_EMAILS.includes(email)) {
    return NextResponse.json({
      hasAccess: true,
      subscription: { status: 'active', onboarding_status: 'completed' },
    })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 500 })
  }

  const admin = createAdminClient()
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const { data: storedSubscription } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const access = await reconcileStripeSubscriptionAccess({
    stripe,
    supabase: admin,
    userId: user.id,
    email,
    knownCustomerIds: [storedSubscription?.stripe_customer_id],
  })

  const { data: subscription } = await admin
    .from('subscriptions')
    .select('status, onboarding_status')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    hasAccess: access.hasAccess,
    subscription: subscription ?? {
      status: access.status,
      onboarding_status: 'not_booked',
    },
  })
}
