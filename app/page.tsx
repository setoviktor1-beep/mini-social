// app/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostComposer from '@/components/PostComposer'
import Link from 'next/link'
import FeedListClient from '@/components/FeedListClient'
import WhoToFollowRow from '@/components/WhoToFollowRow'
import { attachUserInteractionFlags, getFeedItems, parseTab, type TabKey } from '@/lib/feed-service'
import {
  Home as HomeIcon,
  Search,
  Bell,
  Mail,
  Users,
  Settings,
  Plus,
  TrendingUp,
  Briefcase,
  Store,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

function buildTrendingFromPosts(posts: any[]) {
  const counts: Record<string, number> = {}

  for (const post of posts) {
    const text = [post?.content || '', post?.quoted_post?.content || ''].join('\n')
    const tags: Record<string, boolean> = {}
    const parts = text.split(/\s+/)

    for (const part of parts) {
      const cleaned = part.replace(/^[^#]*#/, '#').replace(/[^\w#]/g, '')
      if (!cleaned.startsWith('#')) continue
      const tag = cleaned.slice(1).toLowerCase()
      if (tag.length < 2 || tag.length > 40) continue
      tags[tag] = true
    }

    Object.keys(tags).forEach((tag) => {
      counts[tag] = (counts[tag] || 0) + 1
    })
  }

  const sorted = Object.entries(counts)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1]
      return a[0].localeCompare(b[0])
    })
    .slice(0, 4)
    .map(([tag, count]) => ({
      tag,
      posts: `${count} ${count === 1 ? 'post' : 'posts'}`,
    }))

  if (sorted.length > 0) return sorted

  return [
    { tag: 'minisocial', posts: `${posts.length} posts` },
    { tag: 'community', posts: 'Live now' },
    { tag: 'updates', posts: 'Fresh posts' },
    { tag: 'discover', posts: 'Explore' },
  ]
}

export default async function Home(props: { searchParams?: { tab?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const homeHref = user ? '/home' : '/'

  const requestedTab = parseTab(props.searchParams?.tab)
  const activeTab: TabKey = user ? (requestedTab || 'latest') : 'latest'
  const [{ posts: rawPosts }, { data: profile }] = await Promise.all([
    getFeedItems({
      supabase,
      user,
      tab: activeTab,
      pageSize: 20,
      mode: 'top',
    }),
    user
      ? supabase
          .from('profiles')
          .select('role, username, display_name, avatar_path')
          .eq('id', user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const postsWithLikeStatus = await attachUserInteractionFlags(supabase, user?.id, rawPosts)
  const userRole = profile?.role
  const currentProfile = profile || null

  const { data: suggestionsRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_path')
    .neq('id', user?.id || '')
    .limit(3)

  const suggestions = suggestionsRaw || []
  const suggestionIds = suggestions.map((item) => item.id)
  const followedSuggestionIds = user && suggestionIds.length > 0
    ? new Set(
        ((await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', suggestionIds)).data || []).map((row: any) => row.following_id)
      )
    : new Set<string>()

  const trending = buildTrendingFromPosts(postsWithLikeStatus)

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-[#F8F9FA] text-slate-800">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px] gap-4">
          {/* LEFT SIDEBAR */}
          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)]">
            <nav className="space-y-1 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
              {[
                { href: homeHref, icon: HomeIcon, label: 'Home', show: true },
                { href: '/services', icon: Store, label: 'Paslaugos', show: true },
                { href: ['pro', 'master', 'admin'].includes(userRole ?? '') ? '/pro' : '/pricing', icon: Briefcase, label: 'Verslo Darbalaukis', show: true },
                { href: '/search', icon: Search, label: 'Explore', show: true },
                { href: '/notifications', icon: Bell, label: 'Notifications', show: true },
                { href: '/messages', icon: Mail, label: 'Messages', show: true },
                { href: '/discussions', icon: Users, label: 'Discussions', show: true },
                { href: '/settings', icon: Settings, label: 'Settings', show: true },
              ].filter(item => item.show).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 hover:translate-x-1 ${
                    item.href === homeHref
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <item.icon size={18} strokeWidth={item.href === homeHref ? 2.5 : 1.5} />
                  {item.label}
                </Link>
              ))}
              {user && (
                <button className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1A1A2E] to-[#16213E] text-sm font-semibold text-white hover:shadow-lg hover:shadow-slate-900/20 transition-all duration-200 hover:-translate-y-0.5">
                  <Plus size={16} />
                  Post
                </button>
              )}
            </nav>
            {user && (
              <div className="mt-3 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">{currentProfile?.display_name || 'User'}</div>
                <div className="text-xs text-slate-500">@{currentProfile?.username || 'profile'}</div>
              </div>
            )}
          </aside>

          {/* MAIN FEED */}
          <main className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {user ? (
                <PostComposer userId={user.id} />
              ) : (
                <div className="border-b border-slate-100 p-4 text-sm text-blue-600 bg-blue-50/50">
                  Sign in to join the conversation.
                </div>
              )}

              {user && (
                <div className="flex border-b border-slate-100">
                  {([
                    { key: 'for_you' as const, label: 'For You' },
                    { key: 'following' as const, label: 'Following' },
                    { key: 'latest' as const, label: 'Latest' },
                  ]).map((t) => {
                    const active = activeTab === t.key
                    return (
                      <Link
                        key={t.key}
                        href={`/home?tab=${t.key}`}
                        className={`relative flex-1 py-3 text-center text-sm font-medium transition-colors hover:bg-slate-50 ${
                          active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {t.label}
                        {active && <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-[#E94560]" />}
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

          {/* RIGHT SIDEBAR */}
          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)] overflow-y-auto">
            {/* Trending */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                <TrendingUp size={16} className="text-[#E94560]" />
                Trending
              </h3>
              <div className="space-y-2">
                {trending.map((item) => (
                  <Link 
                    key={item.tag} 
                    href={`/search?q=%23${encodeURIComponent(item.tag)}`} 
                    className="group block rounded-xl px-3 py-2 hover:bg-slate-50 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#E94560]" />
                      <span className="text-sm font-semibold text-slate-800 group-hover:text-[#E94560] transition-colors">#{item.tag}</span>
                    </div>
                    <div className="text-xs text-slate-400 ml-3.5">{item.posts}</div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Who to follow */}
            <div className="mt-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-900 uppercase tracking-wider">Who to follow</h3>
              <div className="space-y-3">
                {suggestions.map((s: any) => (
                  <WhoToFollowRow
                    key={s.id}
                    suggestion={s}
                    currentUserId={user?.id}
                    initiallyFollowing={followedSuggestionIds.has(s.id)}
                  />
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
