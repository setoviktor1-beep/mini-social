// app/auth/callback/route.ts
import { normalizeNextPath } from '@/lib/auth-redirect'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = normalizeNextPath(searchParams.get('next'))
  return NextResponse.redirect(`${origin}${next}`)
}
