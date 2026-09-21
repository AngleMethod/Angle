import { renderAngleEmail } from '@/lib/email'
import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import Stripe from 'stripe'
import { createAdminClient, findUserByEmail } from '@/lib/supabase'
import {
  reconcileStripeSubscriptionAccess,
  resolveUserForStripeSubscription,
} from '@/lib/stripeSubscriptionAccess'

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env
const ADMIN_NOTIFICATION_EMAIL = 'josh@angle.coach'
const FROM_EMAIL = 'Angle <hello@angle.coach>'

if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
  throw new Error('Missing required Stripe environment variables')
}

const stripe = new Stripe(STRIPE_SECRET_KEY)
const webhookSecret: string = STRIPE_WEBHOOK_SECRET

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatAmount(amount: number | null | undefined, currency: string | null | undefined) {
  if (typeof amount !== 'number' || !currency) return 'Unknown'

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}

async function sendNewSubscriberNotification({
  eventId,
  email,
  userId,
  subscription,
  customerId,
}: {
  eventId: string
  email: string | null
  userId: string
  subscription: Stripe.Subscription
  customerId: string | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.error('[stripe webhook] New subscriber email skipped: RESEND_API_KEY not set')
    return
  }

  const price = subscription.items.data[0]?.price
  const amountValue = price?.unit_amount ?? (price?.unit_amount_decimal ? Number(price.unit_amount_decimal) : null)
  const amount = formatAmount(amountValue, price?.currency)
  const subscriberEmail = email ?? 'Unknown email'
  const subscriptionUrl = `https://dashboard.stripe.com/subscriptions/${subscription.id}`
  const customerUrl = customerId ? `https://dashboard.stripe.com/customers/${customerId}` : null

  const html = renderAngleEmail({eyebrow: 'Welcome to the practice', title: 'A new', accent: 'Angle member.', descriptionHtml: 'A new student has subscribed to Angle.', bodyHtml: `Email: <strong>${escapeHtml(subscriberEmail)}</strong><br>Status: ${escapeHtml(subscription.status)}<br>Amount: ${escapeHtml(amount)}<br>User ID: ${escapeHtml(userId)}<br>Subscription: <a href="${subscriptionUrl}" style="color:#d6ed9b;">${escapeHtml(subscription.id)}</a>${customerUrl ? `<br>Customer: <a href="${customerUrl}" style="color:#d6ed9b;">${escapeHtml(customerId as string)}</a>` : ''}`, actionLabel: 'View subscription', actionUrl: subscriptionUrl})

  const text = `New Angle subscriber

Email: ${subscriberEmail}
Status: ${subscription.status}
Amount: ${amount}
User ID: ${userId}
Subscription: ${subscriptionUrl}
${customerUrl ? `Customer: ${customerUrl}` : ''}`

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send(
      {
        from: FROM_EMAIL,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `New Angle subscriber: ${subscriberEmail}`,
        html,
        text,
      },
      {
        headers: {
          'Idempotency-Key': `new-subscriber-${eventId}`,
        },
      },
    )

    if (error) {
      console.error('[stripe webhook] New subscriber email failed:', error)
    }
  } catch (err) {
    console.error('[stripe webhook] New subscriber email threw:', err)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (!session.subscription) break

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

        // Resolve user identity: metadata → client_reference_id → email lookup → create
        let userId: string | null =
          (session.metadata?.user_id as string | undefined) ??
          session.client_reference_id ??
          null
        let email = (session.customer_details?.email ?? session.customer_email ?? null)?.trim().toLowerCase() ?? null

        if (!userId) {
          if (!email) break

          const existing = await findUserByEmail(supabase, email)

          if (existing) {
            userId = existing.id
          } else {
            const { data: created, error: createErr } = await supabase.auth.admin.createUser({
              email,
              email_confirm: true,
            })
            if (createErr || !created.user) {
              console.error('Failed to create user for email', email, createErr)
              break
            }
            userId = created.user.id
          }
        }

        if (!userId) break

        if (!email) {
          const { data } = await supabase.auth.admin.getUserById(userId)
          email = data.user?.email?.trim().toLowerCase() ?? null
        }

        try {
          const access = await reconcileStripeSubscriptionAccess({
            stripe,
            supabase,
            userId,
            email,
            knownCustomerIds: [session.customer as string | null],
            fallbackSubscription: subscription,
          })

          if (access.hasAccess && access.validSubscriptionCount === 1) {
            await sendNewSubscriberNotification({
              eventId: event.id,
              email,
              userId,
              subscription,
              customerId: access.customerId,
            })
          }
        } catch (err) {
          console.error('Failed to reconcile subscription from Stripe checkout webhook:', err)
          return NextResponse.json({ error: 'Failed to write subscription' }, { status: 500 })
        }
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        const resolved = await resolveUserForStripeSubscription({ stripe, supabase, subscription })
        if (!resolved.userId) {
          console.warn('Stripe subscription webhook could not resolve a user:', subscription.id)
          break
        }

        try {
          await reconcileStripeSubscriptionAccess({
            stripe,
            supabase,
            userId: resolved.userId,
            email: resolved.email,
            knownCustomerIds: [resolved.customerId],
            fallbackSubscription: subscription,
          })
        } catch (err) {
          console.error('Failed to reconcile subscription from Stripe subscription webhook:', err)
          return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
