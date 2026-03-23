// middleware.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hasActiveSubscription, hasProAccess } from '@/lib/subscription-access'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const loginUrl = new URL('/auth/login', request.url)
  loginUrl.searchParams.set('next', pathname)

  // Pass pathname to layout via header
  response.headers.set('x-pathname', pathname)

  const isProtectedUserRoute =
    pathname.startsWith('/messages') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/pro')

  if (isProtectedUserRoute && !user) {
    return NextResponse.redirect(loginUrl)
  }

  // Admin route protection (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!user) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    // Check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'admin' && profile.role !== 'moderator')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }

  if (pathname.startsWith('/pro') && user) {
    const [{ data: profile }, { data: subscription }] = await Promise.all([
      supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single(),
      supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (!hasProAccess(subscription, profile?.role) && !hasActiveSubscription(subscription?.status)) {
      return NextResponse.redirect(new URL('/pricing', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
