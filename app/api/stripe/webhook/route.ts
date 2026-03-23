import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function getStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  return typeof customer === 'string' ? customer : customer?.id ?? null
}

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'MISSING_WEBHOOK_SIGNATURE' }, { status: 400 })
  }

  const body = await request.text()

  let event: Stripe.Event
  try {
    const stripe = getStripe()
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch {
    return NextResponse.json({ error: 'INVALID_SIGNATURE' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()
  const eventObject = event.data.object as unknown as Record<string, unknown>
  const stripeObjectId =
    typeof eventObject.id === 'string'
      ? eventObject.id
      : null

  const { data: duplicateEvent, error: duplicateLookupError } = await supabase
    .from('processed_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle()

  if (duplicateLookupError) {
    return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
  }

  if (duplicateEvent) {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const { error: reserveEventError } = await supabase
    .from('processed_events')
    .insert({
      event_id: event.id,
      event_type: event.type,
      stripe_object_id: stripeObjectId,
    })

  if (reserveEventError) {
    if (reserveEventError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }

    return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
  }

  try {
    // --- checkout.session.completed ---
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session

      // Handle wallet top-up only after funds are settled.
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        const userId = session.metadata?.user_id
        const amount = Number(session.metadata?.topup_amount)

        if (userId && Number.isFinite(amount) && amount > 0) {
          const { error } = await supabase.rpc('credit_wallet_balance', {
            p_user_id: userId,
            p_amount: amount,
          })
          if (error) {
            throw new Error('WEBHOOK_DB_ERROR')
          }
        }
      }

      // Handle subscription checkout completion — link customer_id to user
      if (session.mode === 'subscription') {
        const userId = session.metadata?.user_id
        const customerId = getStripeCustomerId(session.customer)
        const plan = session.metadata?.plan || 'basic'

        if (userId && customerId) {
          const { error } = await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            plan,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

          if (error) {
            throw new Error('WEBHOOK_DB_ERROR')
          }
        }
      }
    }

    // --- Subscription events ---
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription & { current_period_end?: number }
      const userId = subscription.metadata?.user_id
      const plan = subscription.metadata?.plan || 'basic'
      const status = subscription.status

      if (userId) {
        const { error: subscriptionError } = await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: getStripeCustomerId(subscription.customer),
          stripe_subscription_id: subscription.id,
          plan,
          status,
          current_period_end: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        if (subscriptionError) {
          throw new Error('WEBHOOK_DB_ERROR')
        }

        // All paid subscribers (basic/pro/enterprise) get role='pro'.
        // Enterprise-specific features are gated by subscriptions.plan='enterprise', not by role.
        const isActive = status === 'active' || status === 'trialing'
        const role = isActive ? 'pro' : 'user'
        const { error: profileError } = await supabase.from('profiles').update({ role }).eq('id', userId)

        if (profileError) {
          throw new Error('WEBHOOK_DB_ERROR')
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.user_id

      if (userId) {
        const { error: subscriptionError } = await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: getStripeCustomerId(subscription.customer),
          stripe_subscription_id: subscription.id,
          plan: 'free',
          status: 'canceled',
          cancel_at_period_end: false,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        if (subscriptionError) {
          throw new Error('WEBHOOK_DB_ERROR')
        }

        const { error: profileError } = await supabase.from('profiles').update({ role: 'user' }).eq('id', userId)

        if (profileError) {
          throw new Error('WEBHOOK_DB_ERROR')
        }
      }
    }

    const { error: markProcessedError } = await supabase
      .from('processed_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', event.id)

    if (markProcessedError) {
      throw new Error('WEBHOOK_DB_ERROR')
    }
  } catch {
    await supabase
      .from('processed_events')
      .delete()
      .eq('event_id', event.id)

    return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
