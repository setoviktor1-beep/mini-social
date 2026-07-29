import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe'
import { createSupabaseServerClient } from '@/lib/backend-server'

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ error: 'NO_SUBSCRIPTION' }, { status: 404 })
    }

    const stripe = getStripe()
    const appUrl = process.env.APP_URL || new URL(request.url).origin

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/pro`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
