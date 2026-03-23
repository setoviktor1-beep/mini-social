import { createClient } from '@/lib/server-supabase'
import PricingClient from './PricingClient'

export const dynamic = 'force-dynamic'

export default async function PricingPage({ searchParams }: { searchParams?: { checkout?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let currentPlan: string | null = null
  let currentStatus: string | null = null

  if (user) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
      currentPlan = sub.plan
      currentStatus = sub.status
    }
  }

  return (
    <PricingClient
      currentPlan={currentPlan}
      currentStatus={currentStatus}
      checkoutStatus={searchParams?.checkout ?? null}
    />
  )
}
