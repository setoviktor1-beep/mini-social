import { createClient } from '@/lib/server-supabase'
import { redirect } from 'next/navigation'
import ProDashboardTabs from '@/components/pro/ProDashboardTabs'
import { Briefcase, MapPin } from 'lucide-react'
import SubscriptionCard from '@/components/pro/SubscriptionCard'

export const dynamic = 'force-dynamic'

export default async function ProDashboard() {
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

  if (!['pro', 'admin'].includes(profile?.role || '')) {
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
      {/* Header Card */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-6 border border-gray-800 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="text-emerald-500" />
              Verslo Darbalaukis
            </h1>
            <p className="text-gray-400 mt-2 flex items-center gap-2 font-medium">
              {profile?.business_name || profile?.display_name}
              <span className="text-emerald-500/50">•</span>
              <span className="text-gray-500">{profile?.business_category || 'Kategorija nenustatyta'}</span>
            </p>
            <p className="text-gray-500 mt-1 flex items-center gap-2 text-sm">
              <MapPin size={14} />
              Regionas: {profile?.address_text || 'Nepriskirtas'}
            </p>
          </div>
          <div className="flex gap-4 bg-gray-950/50 p-4 rounded-2xl border border-gray-800">
            <div className="text-center px-4 border-r border-gray-800">
              <div className="text-2xl font-bold text-emerald-400">
                {requests?.filter(r => r.status === 'open').length || 0}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Nauji</div>
            </div>
            <div className="text-center px-4">
              <div className="text-2xl font-bold text-blue-400">
                {requests?.filter(r => r.status === 'in_progress').length || 0}
              </div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Vykdomi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Subscription Card */}
      <SubscriptionCard sub={sub ?? null} />

      {/* Tabs and Content */}
      <ProDashboardTabs initialRequests={requests || []} currentUserId={user.id} isEnterprise={isEnterprise} isPro={isPro} />
    </div>
  )
}
