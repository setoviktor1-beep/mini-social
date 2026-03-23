import { createSupabaseServerClient } from '@/lib/supabase/server'
import { hasActiveSubscription, hasProAccess } from '@/lib/subscription-access'

export { hasActiveSubscription, hasProAccess }

export async function getCurrentUserAccess() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { supabase, user: null, profile: null, subscription: null }
  }

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
    supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  return { supabase, user, profile, subscription }
}
