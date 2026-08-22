import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/backend-server'

async function addSignedReceiptUrls(receipts: any[]) {
  const serviceClient = createSupabaseServiceClient()

  return Promise.all(
    receipts.map(async (receipt) => {
      if (!receipt.image_url || /^https?:\/\//.test(receipt.image_url)) {
        return receipt
      }

      const { data } = await serviceClient.storage
        .from('receipts')
        .createSignedUrl(receipt.image_url, 5 * 60)

      return {
        ...receipt,
        image_url: data?.signedUrl || null,
      }
    })
  )
}

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

  const receipts = await addSignedReceiptUrls(data || [])
  return NextResponse.json({ receipts })
}

export async function DELETE(request: Request) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const id = typeof body?.id === 'string' ? body.id : null
  if (!id) return NextResponse.json({ error: 'MISSING_ID' }, { status: 400 })

  const { data: receipt } = await supabase
    .from('receipts')
    .select('image_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  const { error } = await supabase
    .from('receipts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })

  if (receipt?.image_url && !/^https?:\/\//.test(receipt.image_url)) {
    const serviceClient = createSupabaseServiceClient()
    await serviceClient.storage.from('receipts').remove([receipt.image_url])
  }

  return NextResponse.json({ ok: true })
}
