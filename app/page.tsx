// app/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostComposer from '@/components/PostComposer'
import Link from 'next/link'
import FeedListClient from '@/components/FeedListClient'
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
    .select('id, username, display_name')
    .neq('id', user?.id || '')
    .limit(3)

  const suggestions = suggestionsRaw || []

  const trending = buildTrendingFromPosts(postsWithLikeStatus)

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] w-screen min-h-screen bg-[#0a0a0f] text-gray-100">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-24 md:pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px] gap-4">
          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)]">
            <nav className="space-y-1 rounded-2xl border border-gray-800/60 bg-gray-900/40 p-2">
              {[
                { href: homeHref, icon: HomeIcon, label: 'Home', show: true },
                { href: '/services', icon: Store, label: 'Paslaugos', show: true },
                { href: '/pro', icon: Briefcase, label: 'Verslo Darbalaukis', show: ['pro', 'master', 'admin'].includes(userRole ?? '') },
                { href: '/search', icon: Search, label: 'Explore', show: true },
                { href: '/notifications', icon: Bell, label: 'Notifications', show: true },
                { href: '/messages', icon: Mail, label: 'Messages', show: true },
                { href: '/discussions', icon: Users, label: 'Discussions', show: true },
                { href: '/settings', icon: Settings, label: 'Settings', show: true },
              ].filter(item => item.show).map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                    item.href === homeHref
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
                        href={`/home?tab=${t.key}`}
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
        <div className="mx-auto grid max-w-md grid-cols-6 py-2">
          <Link href={homeHref} className="flex flex-col items-center gap-1 py-1 text-xs text-white">
            <HomeIcon size={18} />
            Home
          </Link>
          <Link href="/services" className="flex flex-col items-center gap-1 py-1 text-xs text-gray-500">
            <Store size={18} />
            Paslaugos
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
