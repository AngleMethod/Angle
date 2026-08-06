import Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { findUserByEmail } from '@/lib/supabase'
import { hasSubscriptionAccess } from '@/lib/subscriptionStatus'

type StoredSubscriptionRow = {
  user_id: string | null
  stripe_customer_id: string | null
}

type ReconcileInput = {
  stripe: Stripe
  supabase: SupabaseClient
  userId: string
  email?: string | null
  knownCustomerIds?: Array<string | null | undefined>
  fallbackSubscription?: Stripe.Subscription | null
}

type ResolveInput = {
  stripe: Stripe
  supabase: SupabaseClient
  subscription: Stripe.Subscription
}

function stripeId(value: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function periodEnd(subscription: Stripe.Subscription): string | null {
  const itemEnd = subscription.items.data[0]?.current_period_end
  const subscriptionEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end
  const end = itemEnd ?? subscriptionEnd
  return end ? new Date(end * 1000).toISOString() : null
}

function subscriptionPriceId(subscription: Stripe.Subscription) {
  return subscription.items.data[0]?.price.id ?? null
}

function subscriptionCreated(subscription: Stripe.Subscription) {
  return typeof subscription.created === 'number' ? subscription.created : 0
}

function chooseBestSubscription(subscriptions: Stripe.Subscription[]) {
  const valid = subscriptions
    .filter(subscription => hasSubscriptionAccess(subscription.status))
    .sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 'active') return -1
        if (b.status === 'active') return 1
      }
      return subscriptionCreated(b) - subscriptionCreated(a)
    })

  if (valid[0]) return valid[0]

  return [...subscriptions].sort((a, b) => subscriptionCreated(b) - subscriptionCreated(a))[0] ?? null
}

async function listCustomerIdsForUser(
  stripe: Stripe,
  email: string | null | undefined,
  knownCustomerIds: Array<string | null | undefined>
) {
  const customerIds = new Set<string>()

  for (const id of knownCustomerIds) {
    if (id) customerIds.add(id)
  }

  if (email) {
    const customers = await stripe.customers.list({ email, limit: 100 })
    for (const customer of customers.data) {
      customerIds.add(customer.id)
    }
  }

  return Array.from(customerIds)
}

async function listSubscriptionsForCustomers(stripe: Stripe, customerIds: string[]) {
  const subscriptions: Stripe.Subscription[] = []

  for (const customerId of customerIds) {
    const customerSubscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    })
    subscriptions.push(...customerSubscriptions.data)
  }

  return subscriptions
}

export async function reconcileStripeSubscriptionAccess({
  stripe,
  supabase,
  userId,
  email,
  knownCustomerIds = [],
  fallbackSubscription = null,
}: ReconcileInput) {
  const fallbackCustomerId = fallbackSubscription ? stripeId(fallbackSubscription.customer) : null
  const customerIds = await listCustomerIdsForUser(stripe, email, [...knownCustomerIds, fallbackCustomerId])
  const subscriptionsById = new Map<string, Stripe.Subscription>()

  for (const subscription of await listSubscriptionsForCustomers(stripe, customerIds)) {
    subscriptionsById.set(subscription.id, subscription)
  }

  if (fallbackSubscription) {
    subscriptionsById.set(fallbackSubscription.id, fallbackSubscription)
  }

  const subscriptions = Array.from(subscriptionsById.values())
  const selected = chooseBestSubscription(subscriptions)
  const status = selected?.status ?? 'inactive'
  const customerId = selected ? stripeId(selected.customer) : customerIds[0] ?? null

  const { error } = await supabase.from('subscriptions').upsert({
    user_id: userId,
    status,
    stripe_customer_id: customerId,
    stripe_subscription_id: selected?.id ?? null,
    price_id: selected ? subscriptionPriceId(selected) : null,
    current_period_end: selected ? periodEnd(selected) : null,
  }, { onConflict: 'user_id' })

  if (error) throw error

  return {
    hasAccess: hasSubscriptionAccess(status),
    status,
    subscription: selected,
    customerId,
    validSubscriptionCount: subscriptions.filter(subscription => hasSubscriptionAccess(subscription.status)).length,
  }
}

export async function resolveUserForStripeSubscription({
  stripe,
  supabase,
  subscription,
}: ResolveInput) {
  const customerId = stripeId(subscription.customer)
  let userId: string | null = null
  let email: string | null = null

  if (customerId) {
    const { data } = await supabase
      .from('subscriptions')
      .select('user_id, stripe_customer_id')
      .eq('stripe_customer_id', customerId)
      .limit(1)

    const row = ((data as StoredSubscriptionRow[] | null) ?? [])[0] ?? null
    userId = row?.user_id ?? null
  }

  if (userId) {
    const { data } = await supabase.auth.admin.getUserById(userId)
    email = data.user?.email?.toLowerCase() ?? null
  }

  if (!email && customerId) {
    const customer = await stripe.customers.retrieve(customerId)
    if (!customer.deleted) {
      email = customer.email?.trim().toLowerCase() ?? null
    }
  }

  if (!userId && email) {
    const user = await findUserByEmail(supabase, email)
    userId = user?.id ?? null
  }

  return { userId, email, customerId }
}
