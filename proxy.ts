import { NextResponse, type NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { getPool } from '@/lib/db'
import {
  hasActiveSubscription,
  hasProAccess,
} from '@/lib/subscription-access'

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })
  response.headers.set('x-pathname', pathname)

  const session = await auth.api.getSession({ headers: request.headers })
  const user = session?.user

  const protectedPrefixes = [
    '/messages',
    '/notifications',
    '/settings',
    '/my-orders',
    '/pro',
    '/wallet',
    '/bookmarks',
  ]
  const protectedRoute =
    protectedPrefixes.some((prefix) => pathname.startsWith(prefix)) ||
    pathname === '/discussions/new'

  if (pathname === '/' && user) {
    return NextResponse.redirect(new URL('/home', request.url))
  }

  if (protectedRoute && !user) {
    const loginURL = new URL('/auth/login', request.url)
    loginURL.searchParams.set('next', pathname)
    return NextResponse.redirect(loginURL)
  }

  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    const profile = await getPool().query<{ role: string }>(
      'SELECT role FROM profiles WHERE id = $1::uuid',
      [user.id],
    )
    const role = profile.rows[0]?.role
    if (role !== 'admin' && role !== 'moderator') {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (pathname.startsWith('/pro') && user) {
    const [profile, subscription] = await Promise.all([
      getPool().query<{ role: string }>(
        'SELECT role FROM profiles WHERE id = $1::uuid',
        [user.id],
      ),
      getPool().query<{ plan: string; status: string }>(
        `SELECT plan, status
         FROM subscriptions
         WHERE user_id = $1::uuid
         ORDER BY updated_at DESC
         LIMIT 1`,
        [user.id],
      ),
    ])

    const role = profile.rows[0]?.role
    const plan = subscription.rows[0]
    if (
      !hasProAccess(plan, role) &&
      !hasActiveSubscription(plan?.status)
    ) {
      return NextResponse.redirect(new URL('/pricing', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
