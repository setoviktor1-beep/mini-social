// app/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostComposer from '@/components/PostComposer'
import Link from 'next/link'
import FeedListClient from '@/components/FeedListClient'
import {
  Home as HomeIcon,
  Search,
  Bell,
  Mail,
  Users,
  Settings,
  Bookmark,
  Sparkles,
  Plus,
  TrendingUp,
} from 'lucide-react'

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
  let currentProfile: { username?: string; display_name?: string; avatar_path?: string | null } | null = null
  if (user) {
    const [{ data: userLikes }, { data: userReposts }, { data: profile }] = await Promise.all([
      supabase.from('likes').select('post_id').eq('user_id', user.id),
      supabase.from('reposts').select('post_id').eq('user_id', user.id),
      supabase.from('profiles').select('role, username, display_name, avatar_path').eq('id', user.id).single(),
    ])
    if (userLikes) likedPostIds = new Set(userLikes.map((l: any) => l.post_id))
    if (userReposts) repostedPostIds = new Set(userReposts.map((r: any) => r.post_id))
    userRole = profile?.role
    currentProfile = profile || null
  }

  const baseSelect = `
    *,
    profiles:user_id(username, display_name, avatar_path),
    post_media(storage_path),
    quoted_post:quoted_post_id(
      id,
      content,
      youtube_video_id,
      created_at,
      status,
      profiles:user_id(username, display_name, avatar_path),
      post_media(storage_path)
    ),
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
          quoted_post:quoted_post_id(
            id,
            content,
            youtube_video_id,
            created_at,
            status,
            profiles:user_id(username, display_name, avatar_path),
            post_media(storage_path)
          ),
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

  const { data: suggestionsRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name')
    .neq('id', user?.id || '')
    .limit(3)

  const suggestions = suggestionsRaw || []

  const trending = [
    { tag: 'MiniSocial', posts: `${postsWithLikeStatus.length} posts` },
    { tag: 'AIAgents', posts: 'Trending now' },
    { tag: 'WebDev', posts: 'Hot topic' },
    { tag: 'Startups', posts: 'Community' },
  ]

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px] gap-4">
          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)]">
            <nav className="space-y-1 rounded-2xl border border-gray-800/60 bg-gray-900/40 p-2">
              {[
                { href: '/', icon: HomeIcon, label: 'Home' },
                { href: '/search', icon: Search, label: 'Explore' },
                { href: '/notifications', icon: Bell, label: 'Notifications' },
                { href: '/messages', icon: Mail, label: 'Messages' },
                { href: '/discussions', icon: Users, label: 'Discussions' },
                { href: '/settings', icon: Settings, label: 'Settings' },
                { href: '/ai-chat', icon: Sparkles, label: 'AI Chat' },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                    item.href === '/'
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'text-gray-300 hover:bg-gray-800/70'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              ))}
              {user && (
                <button className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 text-sm font-semibold text-white hover:opacity-90">
                  <Plus size={16} />
                  Post
                </button>
              )}
            </nav>
            {user && (
              <div className="mt-3 rounded-2xl border border-gray-800/60 bg-gray-900/40 p-3">
                <div className="text-sm font-semibold text-white">{currentProfile?.display_name || 'User'}</div>
                <div className="text-xs text-gray-400">@{currentProfile?.username || 'profile'}</div>
              </div>
            )}
          </aside>

          <main className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-900/40">
              {user ? (
                <PostComposer userId={user.id} />
              ) : (
                <div className="border-b border-gray-800/60 p-4 text-sm text-blue-300">
                  Sign in to join the conversation.
                </div>
              )}

              {user && (
                <div className="flex border-b border-gray-800/60">
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
                        className={`relative flex-1 py-3 text-center text-sm font-medium transition-colors ${
                          active ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        {t.label}
                        {active && <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-blue-500" />}
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
          </main>

          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)] overflow-y-auto">
            <div className="rounded-2xl border border-gray-800/60 bg-gray-900/40 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-base font-semibold text-white">
                <TrendingUp size={16} className="text-blue-400" />
                Trending
              </h3>
              <div className="space-y-3">
                {trending.map((item) => (
                  <div key={item.tag} className="rounded-xl px-2 py-1.5 hover:bg-gray-800/60">
                    <div className="text-sm font-medium text-white">#{item.tag}</div>
                    <div className="text-xs text-gray-400">{item.posts}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-gray-800/60 bg-gray-900/40 p-4">
              <h3 className="mb-3 text-base font-semibold text-white">Who to follow</h3>
              <div className="space-y-3">
                {suggestions.map((s: any) => (
                  <div key={s.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{s.display_name || s.username}</div>
                      <div className="truncate text-xs text-gray-400">@{s.username}</div>
                    </div>
                    <Link
                      href={`/u/${s.username}`}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black hover:bg-gray-200"
                    >
                      Follow
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-800/60 bg-[#0a0a0f]/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 py-2">
          <Link href="/" className="flex flex-col items-center gap-1 py-1 text-xs text-white">
            <HomeIcon size={18} />
            Home
          </Link>
          <Link href="/search" className="flex flex-col items-center gap-1 py-1 text-xs text-gray-500">
            <Search size={18} />
            Search
          </Link>
          <Link href="/discussions" className="flex flex-col items-center gap-1 py-1 text-xs text-gray-500">
            <Users size={18} />
            Groups
          </Link>
          <Link href="/notifications" className="flex flex-col items-center gap-1 py-1 text-xs text-gray-500">
            <Bell size={18} />
            Alerts
          </Link>
          <Link href="/messages" className="flex flex-col items-center gap-1 py-1 text-xs text-gray-500">
            <Mail size={18} />
            Inbox
          </Link>
        </div>
      </nav>
    </div>
  )
}
