import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/backend-server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  if (sub?.plan !== 'enterprise' || (sub.status !== 'active' && sub.status !== 'trialing')) {
    return NextResponse.json({ error: 'ENTERPRISE_REQUIRED' }, { status: 403 })
  }

  const { data: config } = await supabase
    .from('agent_config')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({ config: config || null })
}

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .single()

  if (sub?.plan !== 'enterprise' || (sub.status !== 'active' && sub.status !== 'trialing')) {
    return NextResponse.json({ error: 'ENTERPRISE_REQUIRED' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }
  const { is_enabled, agent_name, personality, report_frequency, report_day, report_hour, triggers } = body

  const { error } = await supabase
    .from('agent_config')
    .upsert({
      user_id: user.id,
      is_enabled: !!is_enabled,
      agent_name: agent_name || 'Mano Agentas',
      personality: personality || 'profesionalus ir glaustas',
      report_frequency: report_frequency || 'weekly',
      report_day: report_day || 1,
      report_hour: report_hour ?? 8,
      triggers: triggers || [],
      updated_at: new Date().toISOString(),
    })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
