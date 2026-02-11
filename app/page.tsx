// app/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostComposer from '@/components/PostComposer'
import Link from 'next/link'
import FeedListClient from '@/components/FeedListClient'

export const dynamic = 'force-dynamic'

type TabKey = 'for_you' | 'following' | 'latest'

function sortByTimeDesc(a: any, b: any) {
  const at = new Date(a.feed_sort_at || a.created_at).getTime()
  const bt = new Date(b.feed_sort_at || b.created_at).getTime()
  return bt - at
}

export default async function Home(props: { searchParams?: { tab?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const rawTab = props.searchParams?.tab
  const requestedTab: TabKey | null =
    rawTab === 'for_you' || rawTab === 'following' || rawTab === 'latest'
      ? (rawTab as TabKey)
      : null
  const activeTab: TabKey = user ? (requestedTab || 'latest') : 'latest'

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

  // Check user role and liked posts
  let likedPostIds: Set<string> = new Set()
  let repostedPostIds: Set<string> = new Set()
  let userRole: string | undefined
  if (user) {
    const [{ data: userLikes }, { data: userReposts }, { data: profile }] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id),
      supabase.from('reposts').select('post_id').eq('user_id', user.id),
      supabase.from('profiles').select('role').eq('id', user.id).single(),
    ])
    if (userLikes) likedPostIds = new Set(userLikes.map((l: any) => l.post_id))
    if (userReposts) repostedPostIds = new Set(userReposts.map((r: any) => r.post_id))
    userRole = profile?.role
  }

  const baseSelect = `
    *,
    profiles:user_id(username, display_name, avatar_path),
    post_media(storage_path),
    likes(count),
    comments(count),
    reposts(count)
  `

  const applyBlockedFilter = (q: any) => {
    if (!user || blockedUserIds.length === 0) return q
    const inList = blockedUserIds.map((id) => `"${id}"`).join(',')
    return q.not('user_id', 'in', `(${inList})`)
  }

  let posts: any[] = []
  let repostItems: any[] = []

  if (activeTab === 'following' && user) {
    const { data: rows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
    const followedIds = (rows || []).map((r: any) => r.following_id).filter(Boolean)

    if (followedIds.length > 0) {
      let q = supabase
        .from('posts')
        .select(baseSelect)
        .eq('status', 'active')
        .in('user_id', followedIds)
      q = applyBlockedFilter(q)
      const { data } = await q.order('created_at', { ascending: false }).limit(20)
      posts = data || []
    } else {
      posts = []
    }
  } else if (activeTab === 'for_you' && user) {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
    let q = supabase
      .from('posts')
      .select(baseSelect)
      .eq('status', 'active')
      .gte('created_at', since)
    q = applyBlockedFilter(q)

    // Pull a larger set and rank client-side by engagement (likes + comments).
    const { data } = await q.order('created_at', { ascending: false }).limit(80)
    const rows = data || []

    rows.sort((a: any, b: any) => {
      const ap = (a.likes?.[0]?.count || 0) + (a.comments?.[0]?.count || 0)
      const bp = (b.likes?.[0]?.count || 0) + (b.comments?.[0]?.count || 0)
      if (bp !== ap) return bp - ap
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

    posts = rows.slice(0, 20)
  } else {
    let q = supabase
      .from('posts')
      .select(baseSelect)
      .eq('status', 'active')
    q = applyBlockedFilter(q)
    const { data } = await q.order('created_at', { ascending: false }).limit(20)
    posts = data || []
  }

  if (activeTab !== 'for_you') {
    let repostQuery = supabase
      .from('reposts')
      .select(`
        created_at,
        reposter:profiles!reposts_user_id_fkey(id, username, display_name, avatar_path),
        post:posts!reposts_post_id_fkey(
          *,
          profiles:user_id(username, display_name, avatar_path),
          post_media(storage_path),
          likes(count),
          comments(count),
          reposts(count)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(40)

    if (activeTab === 'following' && user) {
      const { data: rows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
      const followedIds = (rows || []).map((r: any) => r.following_id).filter(Boolean)
      if (followedIds.length > 0) {
        repostQuery = repostQuery.in('user_id', followedIds)
      } else {
        repostItems = []
      }
    }

    if (!(activeTab === 'following' && user && repostItems.length === 0)) {
      const { data: repostRows } = await repostQuery
      const blockedSet = new Set(blockedUserIds)
      repostItems = (repostRows || [])
        .map((r: any) => {
          const p = r.post
          if (!p || p.status !== 'active') return null
          return {
            ...p,
            feed_key: `repost-${r.reposter?.id || 'u'}-${p.id}-${r.created_at}`,
            reposted_at: r.created_at,
            reposted_by_profile: r.reposter || null,
            feed_sort_at: r.created_at,
          }
        })
        .filter(Boolean)
        .filter((p: any) => {
          if (!user || blockedSet.size === 0) return true
          const postAuthor = p.user_id
          const reposterId = p.reposted_by_profile?.id
          return !blockedSet.has(postAuthor) && !blockedSet.has(reposterId)
        })
    }
  }

  const baseItems = posts?.map(post => ({
    ...post,
    feed_key: `post-${post.id}`,
    feed_sort_at: post.created_at,
  })) || []

  const merged = [...baseItems, ...repostItems].sort(sortByTimeDesc).slice(0, 20)

  const postsWithLikeStatus = merged.map(post => ({
    ...post,
    user_liked: likedPostIds.has(post.id),
    user_reposted: repostedPostIds.has(post.id),
  }))

  return (
    <div className="space-y-4 sm:space-y-6">
      {user ? (
        <PostComposer userId={user.id} />
      ) : (
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 p-3 sm:p-4 rounded-xl text-blue-700 dark:text-blue-300 text-center text-sm sm:text-base">
          <p>Sign in to join the conversation.</p>
        </div>
      )}

      {user && (
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'for_you' as const, label: 'For You' },
            { key: 'following' as const, label: 'Following' },
            { key: 'latest' as const, label: 'Latest' },
          ]).map((t) => {
            const active = activeTab === t.key
            return (
              <Link
                key={t.key}
                href={`/?tab=${t.key}`}
                className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-semibold transition-colors min-h-[44px] flex items-center justify-center ${
                  active
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200 dark:shadow-blue-900/30'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {t.label}
              </Link>
            )
          })}
        </div>
      )}

      <FeedListClient
        initialPosts={postsWithLikeStatus}
        tab={activeTab}
        currentUserId={user?.id}
        currentUserRole={userRole}
      />
    </div>
  )
}
