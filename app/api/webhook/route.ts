import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import Stripe from 'stripe'
import { createAdminClient, findUserByEmail } from '@/lib/supabase'
import {
  reconcileStripeSubscriptionAccess,
  resolveUserForStripeSubscription,
} from '@/lib/stripeSubscriptionAccess'

const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env
const ADMIN_NOTIFICATION_EMAIL = 'josh@anglemethod.com'
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

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0a;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td align="center" style="padding:40px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
            <tr><td style="padding-bottom:24px;"><span style="font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:#666;">Angle</span></td></tr>
            <tr><td><h1 style="margin:0 0 20px;font-size:32px;line-height:1.1;text-transform:uppercase;">New subscriber</h1></td></tr>
            <tr><td style="padding:20px;border:1px solid #1e1e1e;background:#111110;">
              <p style="margin:0 0 10px;color:#aaa;">Email: <strong style="color:#fff;">${escapeHtml(subscriberEmail)}</strong></p>
              <p style="margin:0 0 10px;color:#aaa;">Status: <strong style="color:#fff;">${escapeHtml(subscription.status)}</strong></p>
              <p style="margin:0 0 10px;color:#aaa;">Amount: <strong style="color:#fff;">${escapeHtml(amount)}</strong></p>
              <p style="margin:0 0 10px;color:#aaa;">User ID: <strong style="color:#fff;">${escapeHtml(userId)}</strong></p>
              <p style="margin:0 0 10px;color:#aaa;">Subscription: <a href="${subscriptionUrl}" style="color:#fff;">${escapeHtml(subscription.id)}</a></p>
              ${customerUrl ? `<p style="margin:0;color:#aaa;">Customer: <a href="${customerUrl}" style="color:#fff;">${escapeHtml(customerId as string)}</a></p>` : ''}
            </td></tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

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
