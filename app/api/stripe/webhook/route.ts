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
  } catch {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()

  // --- Wallet top-up (existing) ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any
    const userId = session.metadata?.user_id
    const amount = Number(session.metadata?.topup_amount)

    if (userId && Number.isFinite(amount) && amount > 0) {
      const { error } = await supabase.rpc('credit_wallet_balance', {
        p_user_id: userId,
        p_amount: amount,
      })
      if (error) {
        return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
      }
    }
  }

  // --- Subscription events ---
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as any
    const userId = subscription.metadata?.user_id
    const plan = subscription.metadata?.plan || 'basic'
    const status = subscription.status

    if (userId) {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        plan,
        status,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // Update profile role based on plan and status
      const isActive = status === 'active' || status === 'trialing'
      const role = isActive ? (plan === 'enterprise' ? 'master' : 'pro') : 'user'
      await supabase.from('profiles').update({ role }).eq('id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as any
    const userId = subscription.metadata?.user_id

    if (userId) {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_subscription_id: subscription.id,
        plan: 'free',
        status: 'canceled',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // Downgrade role
      await supabase.from('profiles').update({ role: 'user' }).eq('id', userId)
    }
  }

  return NextResponse.json({ received: true })
}
