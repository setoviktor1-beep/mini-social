import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function getStripeCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  return typeof customer === 'string' ? customer : customer?.id ?? null
}

function getSubscriptionRole(status: string) {
  return status === 'active' || status === 'trialing' ? 'pro' : 'user'
}

async function markCheckoutSessionCompleted(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  sessionId: string,
  userId?: string
) {
  const completedAt = new Date().toISOString()

  let query = supabase
    .from('billing_checkout_sessions')
    .update({
      status: 'completed',
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('stripe_session_id', sessionId)

  const { data, error } = await query.select('id').limit(1)
  const directMatches = Array.isArray(data) ? data.length > 0 : Boolean(data)
  if (error) return { error, matched: directMatches }
  if (directMatches) return { error: null, matched: true }

  if (!userId) {
    return { error: null, matched: false }
  }

  const fallback = await supabase
    .from('billing_checkout_sessions')
    .update({
      stripe_session_id: sessionId,
      status: 'completed',
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq('user_id', userId)
    .eq('checkout_type', 'subscription')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .select('id')

  return {
    error: fallback.error,
    matched: Array.isArray(fallback.data) ? fallback.data.length > 0 : Boolean(fallback.data),
  }
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

  const { data: existingEvent, error: duplicateLookupError } = await supabase
    .from('processed_events')
    .select('event_id, status, attempt_count')
    .eq('event_id', event.id)
    .maybeSingle()

  if (duplicateLookupError) {
    return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
  }

  if (existingEvent?.status === 'processed') {
    return NextResponse.json({ received: true, duplicate: true })
  }

  const reservePayload = {
    event_type: event.type,
    stripe_object_id: stripeObjectId,
    status: 'processing',
    last_error: null,
    updated_at: new Date().toISOString(),
  }

  const reserveEventError = existingEvent
    ? (
        await supabase
          .from('processed_events')
          .update({
            ...reservePayload,
            attempt_count: (existingEvent.attempt_count ?? 0) + 1,
          })
          .eq('event_id', event.id)
      ).error
    : (
        await supabase
          .from('processed_events')
          .insert({
            event_id: event.id,
            attempt_count: 1,
            ...reservePayload,
          })
      ).error

  if (reserveEventError) {
    return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
  }

  try {
    // --- checkout.session.completed ---
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const sessionUserId = session.metadata?.user_id

      // Handle wallet top-up only after funds are settled.
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        const userId = sessionUserId
        const amount = Number(session.metadata?.topup_amount)

        if (userId && Number.isFinite(amount) && amount > 0) {
          const nowIso = new Date().toISOString()

          // 1) Idempotent reservation: insert-or-ignore the wallet transaction row.
          // stripe_session_id unique index guarantees only one row per Checkout Session.
          const { error: reserveTransactionError } = await supabase
            .from('wallet_transactions')
            .insert({
              user_id: userId,
              stripe_session_id: session.id,
              amount,
              status: 'processing',
            })

          const transactionAlreadyStarted = reserveTransactionError?.code === '23505'
          if (reserveTransactionError && !transactionAlreadyStarted) {
            throw new Error('WEBHOOK_DB_ERROR')
          }

          // 2) If the transaction already completed, skip credit entirely (idempotency).
          const { data: existingTransaction } = await supabase
            .from('wallet_transactions')
            .select('id, status')
            .eq('stripe_session_id', session.id)
            .maybeSingle()

          if (existingTransaction?.status === 'completed') {
            // Already credited; nothing to do.
          } else if (existingTransaction) {
            // 3) Credit exactly once and mark completed in a single DB RPC.
            const { error: creditError } = await supabase.rpc('credit_wallet_and_complete_transaction', {
              p_user_id: userId,
              p_amount: amount,
              p_stripe_session_id: session.id,
            })
            if (creditError) {
              throw new Error('WEBHOOK_DB_ERROR')
            }
          }
        }
      }

      if (session.mode === 'subscription') {
        const userId = sessionUserId
        const customerId = getStripeCustomerId(session.customer)
        const plan = session.metadata?.plan || 'basic'

        if (userId && customerId) {
          const { error } = await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            plan,
            status: 'pending',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

          if (error) {
            console.error('Subscription pending sync failed', {
              eventId: event.id,
              sessionId: session.id,
              userId,
              error,
            })
          }
        }

        const checkoutCompletion = await markCheckoutSessionCompleted(supabase, session.id, userId)
        if (checkoutCompletion.error) {
          console.error('Checkout session completion sync failed', {
            eventId: event.id,
            sessionId: session.id,
            userId,
            error: checkoutCompletion.error,
          })
        } else if (!checkoutCompletion.matched) {
          console.warn('Checkout session row not found during completion sync', {
            eventId: event.id,
            sessionId: session.id,
            userId,
          })
        }
      }
    }

    // --- Subscription events ---
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const subscription = event.data.object as Stripe.Subscription & { current_period_end?: number }
      const userId = subscription.metadata?.user_id
      const plan = subscription.metadata?.plan || 'basic'
      const status = subscription.status
      const currentPeriodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000).toISOString()
        : null

      if (userId) {
        // Resolve which Stripe subscription is the source of truth for this user. The row
        // may already reference a different subscription (e.g. duplicate checkout), so
        // we only overwrite when the incoming event is the latest active subscription or
        // when no subscription_id is currently stored for this user.
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('stripe_subscription_id, current_period_end, status, plan')
          .eq('user_id', userId)
          .maybeSingle()

        const incomingIsActive = status === 'active' || status === 'trialing'
        const existingIsActive = existingSub
          ? (existingSub.status === 'active' || existingSub.status === 'trialing')
          : false
        const existingPeriodEnd = existingSub?.current_period_end
          ? new Date(existingSub.current_period_end).getTime()
          : 0
        const incomingPeriodEnd = currentPeriodEnd ? new Date(currentPeriodEnd).getTime() : 0

        const shouldUpdate =
          !existingSub ||
          !existingSub.stripe_subscription_id ||
          existingSub.stripe_subscription_id === subscription.id ||
          (!existingIsActive && incomingIsActive) ||
          (incomingIsActive && existingIsActive && incomingPeriodEnd > existingPeriodEnd)

        if (shouldUpdate) {
          const { error: subscriptionError } = await supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: getStripeCustomerId(subscription.customer),
            stripe_subscription_id: subscription.id,
            plan,
            status,
            current_period_end: currentPeriodEnd,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' })

          if (subscriptionError) {
            throw new Error('WEBHOOK_DB_ERROR')
          }
        }

        // Protect role from stale events: never downgrade an admin; only promote paid users.
        // All paid subscribers (basic/pro/enterprise) get role='pro'.
        // Enterprise-specific features are gated by subscriptions.plan='enterprise', not by role.
        const { data: currentProfile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle()

        const role = getSubscriptionRole(status)
        if (currentProfile?.role !== 'admin' && role !== currentProfile?.role) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ role })
            .eq('id', userId)
            .neq('role', 'admin')

          if (profileError) {
            throw new Error('WEBHOOK_DB_ERROR')
          }
        }
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription
      const userId = subscription.metadata?.user_id

      if (userId) {
        // Only mark as canceled if the deleted subscription matches the one we currently
        // track for this user. Otherwise ignore stale/cross-customer events.
        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('stripe_subscription_id')
          .eq('user_id', userId)
          .maybeSingle()

        if (existingSub?.stripe_subscription_id === subscription.id) {
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

          const { data: currentProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle()

          if (currentProfile?.role !== 'admin') {
            const { error: profileError } = await supabase
              .from('profiles')
              .update({ role: 'user' })
              .eq('id', userId)
              .neq('role', 'admin')

            if (profileError) {
              throw new Error('WEBHOOK_DB_ERROR')
            }
          }
        }
      }
    }

    const { error: markProcessedError } = await supabase
      .from('processed_events')
      .update({
        status: 'processed',
        processed_at: new Date().toISOString(),
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', event.id)

    if (markProcessedError) {
      throw new Error('WEBHOOK_DB_ERROR')
    }
  } catch (error) {
    await supabase
      .from('processed_events')
      .update({
        status: 'failed',
        last_error: error instanceof Error ? error.message : 'WEBHOOK_DB_ERROR',
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', event.id)

    return NextResponse.json({ error: 'WEBHOOK_DB_ERROR' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
