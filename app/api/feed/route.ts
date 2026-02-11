import { NextResponse } from 'next/server'
import { createClient } from '@/lib/server-supabase'

type TabKey = 'for_you' | 'following' | 'latest'

function parseTab(tab: string | null): TabKey {
  if (tab === 'for_you' || tab === 'following' || tab === 'latest') return tab
  return 'latest'
}

function parsePage(page: string | null) {
  const n = Number(page)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const url = new URL(request.url)
  const tab = parseTab(url.searchParams.get('tab'))
  const page = parsePage(url.searchParams.get('page'))
  const pageSize = 20

  const baseSelect = `
    *,
    profiles:user_id(username, display_name, avatar_path),
    post_media(storage_path),
    likes(count),
    comments(count),
    reposts(count)
  `

  // Block list (both directions)
  let blockedUserIds: string[] = []
  if (user) {
    const [{ data: blocksByMe }, { data: blocksMe }] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', user.id),
    ])
    const ids = [
      ...(blocksByMe || []).map((r: any) => r.blocked_id),
      ...(blocksMe || []).map((r: any) => r.blocker_id),
    ].filter(Boolean)
    blockedUserIds = Array.from(new Set(ids))
  }

  const applyBlockedFilter = (q: any) => {
    if (!user || blockedUserIds.length === 0) return q
    const inList = blockedUserIds.map((id) => `"${id}"`).join(',')
    return q.not('user_id', 'in', `(${inList})`)
  }

  let posts: any[] = []

  if (tab === 'following' && user) {
    const { data: rows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
    const followedIds = (rows || []).map((r: any) => r.following_id).filter(Boolean)
    if (followedIds.length === 0) {
      posts = []
    } else {
      let q = supabase
        .from('posts')
        .select(baseSelect)
        .eq('status', 'active')
        .in('user_id', followedIds)
      q = applyBlockedFilter(q)
      const from = page * pageSize
      const to = from + pageSize - 1
      const { data } = await q
        .order('created_at', { ascending: false })
        .range(from, to)
      posts = data || []
    }
  } else if (tab === 'for_you' && user) {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    let q = supabase
      .from('posts')
      .select(baseSelect)
      .eq('status', 'active')
      .gte('created_at', since)
    q = applyBlockedFilter(q)

    // Fetch a larger pool, rank by engagement, then slice by page.
    const { data } = await q.order('created_at', { ascending: false }).limit(200)
    const rows = data || []
    rows.sort((a: any, b: any) => {
      const ap = (a.likes?.[0]?.count || 0) + (a.comments?.[0]?.count || 0)
      const bp = (b.likes?.[0]?.count || 0) + (b.comments?.[0]?.count || 0)
      if (bp !== ap) return bp - ap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    const from = page * pageSize
    posts = rows.slice(from, from + pageSize)
  } else {
    let q = supabase
      .from('posts')
      .select(baseSelect)
      .eq('status', 'active')
    q = applyBlockedFilter(q)
    const from = page * pageSize
    const to = from + pageSize - 1
    const { data } = await q
      .order('created_at', { ascending: false })
      .range(from, to)
    posts = data || []
  }

  // liked status only for current user and only for returned posts
  let likedPostIds: Set<string> = new Set()
  let repostedPostIds: Set<string> = new Set()
  let userRole: string | undefined
  if (user) {
    const postIds = posts.map((p: any) => p.id).filter(Boolean)
    const [{ data: likes }, { data: reposts }, { data: profile }] = await Promise.all([
      postIds.length > 0
        ? supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      postIds.length > 0
        ? supabase.from('reposts').select('post_id').eq('user_id', user.id).in('post_id', postIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase.from('profiles').select('role').eq('id', user.id).single(),
    ])
    if (likes) likedPostIds = new Set(likes.map((l: any) => l.post_id))
    if (reposts) repostedPostIds = new Set(reposts.map((r: any) => r.post_id))
    userRole = profile?.role
  }

  const postsWithLikeStatus = posts.map((post: any) => ({
    ...post,
    user_liked: likedPostIds.has(post.id),
    user_reposted: repostedPostIds.has(post.id),
  }))

  return NextResponse.json({
    tab,
    page,
    pageSize,
    userRole: userRole || null,
    posts: postsWithLikeStatus,
    hasMore: postsWithLikeStatus.length === pageSize,
  })
}
