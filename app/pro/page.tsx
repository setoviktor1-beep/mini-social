import { createClient } from '@/lib/backend-server'
import { redirect } from 'next/navigation'
import ProDashboardTabs from '@/components/pro/ProDashboardTabs'
import ProDashboardHeader from '@/components/pro/ProDashboardHeader'
import SubscriptionCard from '@/components/pro/SubscriptionCard'
import SubscribedBanner from '@/components/pro/SubscribedBanner'

export const dynamic = 'force-dynamic'

export default async function ProDashboard(props: { searchParams: Promise<{ subscribed?: string }> }) {
  const searchParams = await props.searchParams;
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Check profile role — all paid subscribers receive role='pro'; admins are also allowed
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, display_name, address_text, business_name, business_category')
    .eq('id', user.id)
    .single()

  if (!['pro', 'master', 'admin'].includes(profile?.role || '')) {
    redirect('/pricing')
  }

  // Check subscription status — must be active or trialing
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
    .eq('user_id', user.id)
    .single()

  const isActiveSubscription = sub?.status === 'active' || sub?.status === 'trialing'

  // Admins bypass subscription check; all others must have an active/trialing subscription
  if (profile?.role !== 'admin' && !isActiveSubscription) {
    redirect('/pricing')
  }

  // Feature flags based on subscription plan
  const isEnterprise = sub?.plan === 'enterprise' && isActiveSubscription
  const isPro = (sub?.plan === 'pro' || sub?.plan === 'enterprise') && isActiveSubscription

  // Ištraukiame užklausas
  const { data: requests } = await supabase
    .from('service_requests')
    .select('*, client:profiles!client_id(display_name, username)')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {searchParams.subscribed === '1' && <SubscribedBanner plan={sub?.plan ?? null} />}

      {/* Header Card */}
      <ProDashboardHeader
        userId={user.id}
        businessName={profile?.business_name ?? null}
        displayName={profile?.display_name ?? null}
        businessCategory={profile?.business_category ?? null}
        addressText={profile?.address_text ?? null}
        openCount={requests?.filter(r => r.status === 'open').length ?? 0}
        inProgressCount={requests?.filter(r => r.status === 'in_progress').length ?? 0}
      />

      {/* Subscription Card */}
      <SubscriptionCard sub={sub ?? null} />

      {/* Tabs and Content */}
      <ProDashboardTabs initialRequests={requests || []} currentUserId={user.id} isEnterprise={isEnterprise} isPro={isPro} />
    </div>
  )
}
