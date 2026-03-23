import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'

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

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/pro?subscribed=1`,
      cancel_url: `${appUrl}/pricing`,
      metadata: { user_id: user.id, plan },
      subscription_data: {
        metadata: { user_id: user.id, plan },
        ...(trialDays ? { trial_period_days: trialDays } : {}),
      },
      allow_promotion_codes: true,
      payment_method_collection: trialDays ? 'if_required' : 'always',
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Subscribe error:', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
