import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server-supabase'
import { attachUserInteractionFlags, getFeedItems, parsePage, parseTab } from '@/lib/feed-service'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const url = new URL(request.url)
  const tab = parseTab(url.searchParams.get('tab'))
  const page = parsePage(url.searchParams.get('page'))
  const pageSize = 20
  const [{ posts: rawPosts }, { data: profile }] = await Promise.all([
    getFeedItems({
      supabase,
      user,
      tab,
      page,
      pageSize,
      mode: 'paged',
    }),
    user ? supabase.from('profiles').select('role').eq('id', user.id).single() : Promise.resolve({ data: null }),
  ])

  const postsWithLikeStatus = await attachUserInteractionFlags(supabase, user?.id, rawPosts)
  const userRole = profile?.role

  return NextResponse.json({
    tab,
    page,
    pageSize,
    userRole: userRole || null,
    posts: postsWithLikeStatus,
    hasMore: postsWithLikeStatus.length === pageSize,
  })
}
