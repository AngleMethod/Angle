import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createAdminClient, findUserByEmail } from '@/lib/supabase'
import { SUBSCRIPTION_ACCESS_STATUSES } from '@/lib/subscriptionStatus'

const SIGNING_KEY = process.env.CALENDLY_WEBHOOK_SIGNING_KEY

if (!SIGNING_KEY) {
  throw new Error('Missing CALENDLY_WEBHOOK_SIGNING_KEY')
}

function verifySignature(body: string, header: string | null): boolean {
  if (!header) return false

  const parts: Record<string, string> = {}
  header.split(',').forEach(part => {
    const [key, ...rest] = part.split('=')
    parts[key] = rest.join('=')
  })

  const timestamp = parts['t']
  const signature = parts['v1']
  if (!timestamp || !signature) return false

  // Reject events older than 5 minutes
  const ageSeconds = Date.now() / 1000 - parseInt(timestamp, 10)
  if (ageSeconds > 300) return false

  const expected = createHmac('sha256', SIGNING_KEY!)
    .update(`${timestamp}.${body}`)
    .digest('hex')

  try {
    return timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expected, 'hex')
    )
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()

  if (!verifySignature(body, req.headers.get('Calendly-Webhook-Signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const event = JSON.parse(body)
  const eventType: string = event.event
  const email: string | undefined = event.payload?.email?.toLowerCase()

  console.error('Calendly webhook:', eventType, email)

  if (!email) {
    return NextResponse.json({ received: true })
  }

  const admin = createAdminClient()

  const user = await findUserByEmail(admin, email)

  if (!user) {
    // Booked via Calendly but not a subscriber — nothing to update
    return NextResponse.json({ received: true })
  }

  if (eventType === 'invitee.created') {
    const { error } = await admin
      .from('subscriptions')
      .update({ onboarding_status: 'booked' })
      .eq('user_id', user.id)
      .in('status', [...SUBSCRIPTION_ACCESS_STATUSES])

    if (error) {
      console.error('Failed to update subscription from Calendly created webhook:', error)
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 })
    }
  } else if (eventType === 'invitee.canceled') {
    // Only reset if currently booked — don't touch completed users
    const { error } = await admin
      .from('subscriptions')
      .update({ onboarding_status: 'not_booked' })
      .eq('user_id', user.id)
      .in('status', [...SUBSCRIPTION_ACCESS_STATUSES])
      .eq('onboarding_status', 'booked')

    if (error) {
      console.error('Failed to update subscription from Calendly canceled webhook:', error)
      return NextResponse.json({ error: 'Failed to update booking status' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
