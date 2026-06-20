import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const body = await request.json().catch(() => null)
    if (body?.confirm !== 'DELETE') {
      return NextResponse.json({ error: 'CONFIRMATION_REQUIRED' }, { status: 400 })
    }

    const serviceClient = createSupabaseServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .single()

    if (profile?.avatar_path) {
      await serviceClient.storage.from('post-images').remove([profile.avatar_path])
    }

    const { error } = await serviceClient.auth.admin.deleteUser(user.id)
    if (error) {
      console.error('Account delete error:', error)
      return NextResponse.json({ error: 'DELETE_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Account delete error:', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
