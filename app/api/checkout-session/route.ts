import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const { STRIPE_SECRET_KEY } = process.env

if (!STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY')
}

const stripe = new Stripe(STRIPE_SECRET_KEY)

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')

  if (!sessionId || !sessionId.startsWith('cs_')) {
    return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    const isPaid = session.payment_status === 'paid' || session.status === 'complete'
    if (!isPaid) {
      return NextResponse.json({ error: 'Session not paid' }, { status: 404 })
    }

    const email = session.customer_details?.email ?? session.customer_email ?? null
    if (!email) {
      return NextResponse.json({ error: 'Email not found on session' }, { status: 404 })
    }

    return NextResponse.json({ email })
  } catch (err) {
    console.error('Checkout session lookup error:', err)
    return NextResponse.json({ error: 'Unable to retrieve session' }, { status: 404 })
  }
}
