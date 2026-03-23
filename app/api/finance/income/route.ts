import { NextResponse } from 'next/server'
import { getCurrentUserAccess, hasProAccess } from '@/lib/server/access'

export async function GET(request: Request) {
  const { supabase, user, profile, subscription } = await getCurrentUserAccess()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasProAccess(subscription, profile?.role)) {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') || new Date().toISOString().slice(0, 7)

  const { data } = await supabase
    .from('monthly_income')
    .select('*')
    .eq('user_id', user.id)
    .eq('month', month)
    .single()

  return NextResponse.json({ income: data || null, month })
}

export async function POST(request: Request) {
  const { supabase, user, profile, subscription } = await getCurrentUserAccess()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!hasProAccess(subscription, profile?.role)) {
    return NextResponse.json({ error: 'PRO_REQUIRED' }, { status: 403 })
  }

  const { month, amount, note } = await request.json()
  if (!month || amount === undefined) {
    return NextResponse.json({ error: 'MISSING_FIELDS' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('monthly_income')
    .upsert({
      user_id: user.id,
      month,
      amount: Number(amount),
      note: note || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,month' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ income: data })
}
