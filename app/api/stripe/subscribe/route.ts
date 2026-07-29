import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServerClient } from '@/lib/backend-server'

const PLAN_PRICE_IDS: Record<string, string | undefined> = {
  basic:      process.env.STRIPE_PRICE_BASIC,
  pro:        process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
}

export async function POST(request: Request) {
  try {
    const { plan } = await request.json()

    if (!plan || !['basic', 'pro', 'enterprise'].includes(plan)) {
      return NextResponse.json({ error: 'INVALID_PLAN' }, { status: 400 })
    }

    const priceId = PLAN_PRICE_IDS[plan]
    if (!priceId) {
      return NextResponse.json({ error: 'MISSING_PRICE_ID' }, { status: 500 })
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const stripe = getStripe()
    const appUrl = process.env.APP_URL || new URL(request.url).origin
    const nowIso = new Date().toISOString()

    // Get existing subscription + customer id in one query
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, plan, status')
      .eq('user_id', user.id)
      .single()

    // Guard: block duplicate purchase if already actively subscribed
    if (sub && (sub.status === 'active' || sub.status === 'trialing')) {
      return NextResponse.json({ error: 'ALREADY_SUBSCRIBED', plan: sub.plan }, { status: 409 })
    }

    await supabase
      .from('billing_checkout_sessions')
      .update({ status: 'expired', updated_at: nowIso })
      .eq('user_id', user.id)
      .eq('checkout_type', 'subscription')
      .eq('status', 'pending')
      .lt('expires_at', nowIso)

    const { data: pendingCheckout } = await supabase
      .from('billing_checkout_sessions')
      .select('id, session_url')
      .eq('user_id', user.id)
      .eq('checkout_type', 'subscription')
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .maybeSingle()

    if (pendingCheckout?.session_url) {
      return NextResponse.json({ url: pendingCheckout.session_url, reused: true })
    }

    if (pendingCheckout) {
      return NextResponse.json({ error: 'CHECKOUT_IN_PROGRESS' }, { status: 409 })
    }

    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single()

      const customer = await stripe.customers.create({
        email: user.email,
        name: profile?.username || user.email,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
    }

    // Pro and Enterprise get 14-day free trial; Basic has no trial
    const trialDays = (plan === 'pro' || plan === 'enterprise') ? 14 : undefined

    const { data: checkoutRow, error: checkoutInsertError } = await supabase
      .from('billing_checkout_sessions')
      .insert({
        user_id: user.id,
        checkout_type: 'subscription',
        plan,
      })
      .select('id')
      .single()

    if (checkoutInsertError || !checkoutRow) {
      return NextResponse.json({ error: 'CHECKOUT_LOCK_FAILED' }, { status: 500 })
    }

    let session
    try {
      session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${appUrl}/pricing?checkout=success`,
        cancel_url: `${appUrl}/pricing`,
        metadata: { user_id: user.id, plan },
        subscription_data: {
          metadata: { user_id: user.id, plan },
          ...(trialDays ? { trial_period_days: trialDays } : {}),
        },
        allow_promotion_codes: true,
        payment_method_collection: trialDays ? 'if_required' : 'always',
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

    await supabase
      .from('billing_checkout_sessions')
      .update({
        stripe_session_id: session.id,
        session_url: session.url,
        updated_at: new Date().toISOString(),
      })
      .eq('id', checkoutRow.id)

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
