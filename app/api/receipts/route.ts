import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const month = searchParams.get('month') // YYYY-MM

  let query = supabase
    .from('receipts')
    .select('*')
    .eq('user_id', user.id)
    .order('receipt_date', { ascending: false })

  if (month) {
    const start = `${month}-01`
    const end = `${month}-31`
    query = query.gte('receipt_date', start).lte('receipt_date', end)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })

  return NextResponse.json({ receipts: data || [] })
}

export async function DELETE(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const { id } = await request.json()
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
