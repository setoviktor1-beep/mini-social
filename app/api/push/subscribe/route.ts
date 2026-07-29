import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/backend-server'

export async function POST(req: NextRequest) {
  try {
    const supabaseAuth = createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { subscription } = body

    if (!subscription) {
      return NextResponse.json({ error: 'Missing subscription' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const { endpoint, keys } = subscription
    const { p256dh, auth } = keys || {}

    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid subscription format' }, { status: 400 })
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(
        { user_id: user.id, endpoint, p256dh, auth },
        { onConflict: 'user_id,endpoint' }
      )

    if (error) {
      console.error('Error saving push subscription:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Push subscribe error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
