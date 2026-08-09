import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/backend-server'

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

    // Post images and receipt scans live in S3/MinIO and are not covered by
    // the DB cascade delete below — remove them explicitly so a deleted
    // account doesn't leave orphaned files behind (GDPR).
    const [{ data: media }, { data: receipts }] = await Promise.all([
      serviceClient.from('post_media').select('storage_path').eq('user_id', user.id),
      serviceClient.from('receipts').select('image_url').eq('user_id', user.id),
    ])

    const mediaPaths = (media || [])
      .map((row: { storage_path: string | null }) => row.storage_path)
      .filter((path): path is string => Boolean(path))
    if (mediaPaths.length) {
      await serviceClient.storage.from('post-images').remove(mediaPaths)
    }

    const receiptPaths = (receipts || [])
      .map((row: { image_url: string | null }) => row.image_url)
      .filter((path): path is string => typeof path === 'string' && path.length > 0 && !/^https?:\/\//.test(path))
    if (receiptPaths.length) {
      await serviceClient.storage.from('receipts').remove(receiptPaths)
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
