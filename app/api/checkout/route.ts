
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase'
import { reconcileStripeSubscriptionAccess } from '@/lib/stripeSubscriptionAccess'

const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID, NEXT_PUBLIC_SITE_URL } = process.env

if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID || !NEXT_PUBLIC_SITE_URL) {
  throw new Error('Missing required Stripe environment variables')
}

const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const userId: string | undefined = body?.userId
    let customerId: string | null = null
    let customerEmail: string | null = null

    if (userId) {
      const supabase = createAdminClient()
      const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(userId)
      const user = userData.user

      if (userErr || !user) {
        return NextResponse.json({ error: 'Invalid user' }, { status: 400 })
      }

      customerEmail = user.email?.trim().toLowerCase() ?? null

      const { data: storedSubscription } = await supabase
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle()

      const access = await reconcileStripeSubscriptionAccess({
        stripe,
        supabase,
        userId,
        email: customerEmail,
        knownCustomerIds: [storedSubscription?.stripe_customer_id],
      })

      if (access.hasAccess) {
        return NextResponse.json({
          url: `${NEXT_PUBLIC_SITE_URL}/dashboard`,
          existingSubscription: true,
        })
      }

      customerId = access.customerId
    }

    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      ...(userId
        ? {
            client_reference_id: userId,
            metadata: { user_id: userId },
          }
        : {}),
      success_url: `${NEXT_PUBLIC_SITE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: NEXT_PUBLIC_SITE_URL,
    }

    if (customerId) {
      checkoutParams.customer = customerId
    } else if (customerEmail) {
      checkoutParams.customer_email = customerEmail
    }

    const session = await stripe.checkout.sessions.create(checkoutParams)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe error:', error)
    return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 })
  }
}
