import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'MISSING_WEBHOOK_SIGNATURE' }, { status: 400 })
  }

  const body = await request.text()

  let event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (error) {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const userId = session.metadata?.user_id
    const amount = Number(session.metadata?.topup_amount)

    if (userId && Number.isFinite(amount) && amount > 0) {
      const supabase = createSupabaseServiceClient()
      const { error } = await supabase.rpc('credit_wallet_balance', {
        p_user_id: userId,
        p_amount: amount,
      })
      if (error) {
        return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}
