import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

    const appUrl = process.env.APP_URL || new URL(request.url).origin
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/wallet/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/wallet/cancel`,
      metadata: {
        user_id: user.id,
        topup_amount: String(amount),
      },
    })

    if (!session.url) {
      return NextResponse.json({ error: 'CHECKOUT_URL_NOT_AVAILABLE' }, { status: 500 })
    }

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
