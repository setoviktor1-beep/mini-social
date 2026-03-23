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

  // --- checkout.session.completed ---
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as any

    // Handle wallet top-up (payment mode)
    if (session.mode === 'payment') {
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

    // Handle subscription checkout completion — link customer_id to user
    if (session.mode === 'subscription') {
      const userId = session.metadata?.user_id
      const customerId = session.customer
      const plan = session.metadata?.plan || 'basic'

      if (userId && customerId) {
        // Upsert the customer ID so it is stored even before subscription events fire
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          plan,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
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
        current_period_end: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        cancel_at_period_end: subscription.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // All paid subscribers (basic/pro/enterprise) get role='pro'.
      // Enterprise-specific features are gated by subscriptions.plan='enterprise', not by role.
      const isActive = status === 'active' || status === 'trialing'
      const role = isActive ? 'pro' : 'user'
      await supabase.from('profiles').update({ role }).eq('id', userId)
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as any
    const userId = subscription.metadata?.user_id

    if (userId) {
      await supabase.from('subscriptions').upsert({
        user_id: userId,
        stripe_customer_id: subscription.customer,
        stripe_subscription_id: subscription.id,
        plan: 'free',
        status: 'canceled',
        cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })

      // Downgrade role on cancellation
      await supabase.from('profiles').update({ role: 'user' }).eq('id', userId)
    }
  }

  return NextResponse.json({ received: true })
}
