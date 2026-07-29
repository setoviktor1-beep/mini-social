import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServerClient } from '@/lib/backend-server'

type TopupAmount = 5 | 10 | 20

const PRICE_ID_BY_AMOUNT: Record<TopupAmount, string | undefined> = {
  5: process.env.STRIPE_PRICE_ID_5,
  10: process.env.STRIPE_PRICE_ID_10,
  20: process.env.STRIPE_PRICE_ID_20,
}

function parseAmount(value: unknown): TopupAmount | null {
  if (value === 5 || value === 10 || value === 20) return value
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    const amount = parseAmount(body?.amount)
    if (!amount) {
      return NextResponse.json({ error: 'INVALID_AMOUNT' }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const priceId = PRICE_ID_BY_AMOUNT[amount]
    if (!priceId) {
      return NextResponse.json({ error: 'MISSING_STRIPE_PRICE_ID' }, { status: 500 })
    }

    const nowIso = new Date().toISOString()
    await supabase
      .from('billing_checkout_sessions')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('user_id', user.id)
      .eq('checkout_type', 'wallet')
      .eq('status', 'pending')
      .lt('expires_at', nowIso)

    const { data: pendingSession } = await supabase
      .from('billing_checkout_sessions')
      .select('id, session_url')
      .eq('user_id', user.id)
      .eq('checkout_type', 'wallet')
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .maybeSingle()

    if (pendingSession?.session_url) {
      return NextResponse.json({ url: pendingSession.session_url, reused: true })
    }

    if (pendingSession) {
      return NextResponse.json({ error: 'CHECKOUT_IN_PROGRESS' }, { status: 409 })
    }

    const { data: checkoutRow, error: checkoutInsertError } = await supabase
      .from('billing_checkout_sessions')
      .insert({
        user_id: user.id,
        checkout_type: 'wallet',
        amount,
      })
      .select('id')
      .single()

    if (checkoutInsertError || !checkoutRow) {
      return NextResponse.json({ error: 'CHECKOUT_LOCK_FAILED' }, { status: 500 })
    }

    const appUrl = process.env.APP_URL || new URL(request.url).origin
    const stripe = getStripe()
    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/wallet/cancel`,
        metadata: {
          user_id: user.id,
          topup_amount: String(amount),
        },
      }, {
        idempotencyKey: checkoutRow.id,
      })
    } catch (error) {
      await supabase
        .from('billing_checkout_sessions')
        .update({
          status: 'failed',
          last_error: 'stripe_session_create_failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkoutRow.id)
      throw error
    }

    if (!session.url) {
      await supabase
        .from('billing_checkout_sessions')
        .update({
          status: 'failed',
          last_error: 'checkout_url_not_available',
          updated_at: new Date().toISOString(),
        })
        .eq('id', checkoutRow.id)
      return NextResponse.json({ error: 'CHECKOUT_URL_NOT_AVAILABLE' }, { status: 500 })
    }

    const { error: checkoutUpdateError } = await supabase
      .from('billing_checkout_sessions')
      .update({
        stripe_session_id: session.id,
        session_url: session.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkoutRow.id)

    if (checkoutUpdateError) {
      return NextResponse.json({ error: 'CHECKOUT_PERSIST_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
