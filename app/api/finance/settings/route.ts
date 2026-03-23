import { NextResponse } from 'next/server'
import { getCurrentUserAccess, hasProAccess } from '@/lib/server/access'

export async function GET() {
  const { supabase, user, profile, subscription } = await getCurrentUserAccess()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasProAccess(subscription, profile?.role)) {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const { data } = await supabase
    .from('financial_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    settings: data || {
      gpm_percent: 15,
      sodra_percent: 12.52,
      pvm_percent: 21,
      is_pvm_payer: false,
      business_type: 'individual',
    },
  })
}

export async function PUT(request: Request) {
  const { supabase, user, profile, subscription } = await getCurrentUserAccess()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasProAccess(subscription, profile?.role)) {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const body = await request.json()
  const { gpm_percent, sodra_percent, pvm_percent, is_pvm_payer, business_type } = body

  const { error } = await supabase
    .from('financial_settings')
    .upsert({
      user_id: user.id,
      gpm_percent: Number(gpm_percent) || 15,
      sodra_percent: Number(sodra_percent) || 12.52,
      pvm_percent: Number(pvm_percent) || 21,
      is_pvm_payer: Boolean(is_pvm_payer),
      business_type: business_type || 'individual',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
