
import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID, NEXT_PUBLIC_SITE_URL } = process.env

if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID || !NEXT_PUBLIC_SITE_URL) {
  throw new Error('Missing required Stripe environment variables')
}

const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function POST(req: NextRequest) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return NextResponse.json({ error: 'User must be signed in to checkout' }, { status: 401 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      client_reference_id: userId,
      success_url: `${NEXT_PUBLIC_SITE_URL}/dashboard`,
      cancel_url: NEXT_PUBLIC_SITE_URL,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Stripe error:', error)
    return NextResponse.json({ error: 'Unable to create checkout session' }, { status: 500 })
  }
}