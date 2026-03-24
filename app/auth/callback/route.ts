// app/auth/callback/route.ts
import { createClient } from '@/lib/server-supabase'
import { NextResponse } from 'next/server'

function normalizeNextPath(next: string | null) {
  if (!next || !next.startsWith('/')) {
    return '/home'
  }

  if (next.startsWith('//')) {
    return '/home'
  }

  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = normalizeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
