import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/backend-server'
import webpush from 'web-push'

export async function POST(req: NextRequest) {
  // Server-to-server only.
  const authHeader = req.headers.get('authorization')
  const internalKey = process.env.INTERNAL_API_SECRET
  if (!internalKey || authHeader !== `Bearer ${internalKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { userId, title, body, url } = await req.json()

    if (!userId || !title) {
      return NextResponse.json({ error: 'Missing userId or title' }, { status: 400 })
    }

    // Set VAPID details inside the handler so env vars are available at runtime
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:support@minisocial.lt',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    )

    const supabase = createServiceClient()

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', userId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found' }, { status: 200 })
    }

    const payload = JSON.stringify({ title, body: body || '', url: url || '/' })

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      )
    )

    const failures = results.filter((r) => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(`${failures.length} push notification(s) failed`)
    }

    return NextResponse.json({ sent: results.length - failures.length, failed: failures.length })
  } catch (err) {
    console.error('Push send error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
