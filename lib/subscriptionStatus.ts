export const SUBSCRIPTION_ACCESS_STATUSES = ['active', 'trialing'] as const

export function hasSubscriptionAccess(status: string | null | undefined) {
  return SUBSCRIPTION_ACCESS_STATUSES.includes(status as typeof SUBSCRIPTION_ACCESS_STATUSES[number])
}
