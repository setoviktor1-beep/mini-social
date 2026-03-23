type SubscriptionRow = {
  plan: string | null
  status: string | null
}

export function hasActiveSubscription(status: string | null | undefined) {
  return status === 'active' || status === 'trialing'
}

export function hasProAccess(subscription: SubscriptionRow | null, role?: string | null) {
  if (role === 'admin') {
    return true
  }

  return (
    hasActiveSubscription(subscription?.status) &&
    (subscription?.plan === 'pro' || subscription?.plan === 'enterprise')
  )
}
