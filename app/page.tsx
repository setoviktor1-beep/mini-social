// app/page.tsx
import { createClient } from '@/lib/backend-server'
import PostComposer from '@/components/PostComposer'
import Link from 'next/link'
import FeedListClient from '@/components/FeedListClient'
import LandingPage from '@/components/LandingPage'
import WhoToFollowRow from '@/components/WhoToFollowRow'
import { attachUserInteractionFlags, getFeedItems, parseTab, type TabKey } from '@/lib/feed-service'
import {
  Home as HomeIcon,
  Search,
  Bell,
  Mail,
  Users,
  Settings,
  TrendingUp,
  Briefcase,
  Store,
  Bookmark,
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
      posts: `${count} ${count === 1 ? 'įrašas' : 'įrašai'}`,
    }))

  return sorted
}

export default async function Home(props: { searchParams?: Promise<{ tab?: string }> }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <LandingPage />
  }

  const homeHref = '/home'

  const requestedTab = parseTab((await props.searchParams)?.tab)
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
          .select('role')
          .eq('id', user.id)
          .single()
      : Promise.resolve({ data: null }),
  ])

  const postsWithLikeStatus = await attachUserInteractionFlags(supabase, user?.id, rawPosts)
  const userRole = profile?.role
  let suggestionsQuery = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_path')

  if (user) {
    suggestionsQuery = suggestionsQuery.neq('id', user.id)
  }

  const { data: suggestionsRaw } = await suggestionsQuery.limit(3)

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
  const showRightSidebar = trending.length > 0 || suggestions.length > 0

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[calc(100dvh-6rem)] w-screen bg-[#F8F9FA] text-slate-800">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-24 md:pb-8">
        <div className={`grid grid-cols-1 gap-4 ${
          showRightSidebar
            ? 'lg:grid-cols-[240px_minmax(0,1fr)_300px]'
            : 'lg:grid-cols-[240px_minmax(0,1fr)]'
        }`}>
          {/* LEFT SIDEBAR */}
          <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)]">
            <nav className="space-y-1 rounded-2xl border border-slate-200/80 bg-white p-2 shadow-sm">
              {[
                { href: homeHref, icon: HomeIcon, label: 'Pagrindinis', show: true },
                { href: '/services', icon: Store, label: 'Paslaugos', show: true },
                { href: ['pro', 'master', 'admin'].includes(userRole ?? '') ? '/pro' : '/pricing', icon: Briefcase, label: 'Verslo darbalaukis', show: true },
                { href: '/search', icon: Search, label: 'Atrasti', show: true },
                { href: '/notifications', icon: Bell, label: 'Pranešimai', show: true },
                { href: '/messages', icon: Mail, label: 'Žinutės', show: true },
                { href: '/discussions', icon: Users, label: 'Diskusijos', show: true },
                { href: '/bookmarks', icon: Bookmark, label: 'Išsaugoti', show: true },
                { href: '/settings', icon: Settings, label: 'Nustatymai', show: true },
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
            </nav>
          </aside>

          {/* MAIN FEED */}
          <main className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              {user ? (
                <div id="post-composer" className="scroll-mt-20">
                  <PostComposer userId={user.id} />
                </div>
              ) : (
                <div className="border-b border-slate-100 p-4 text-sm text-blue-600 bg-blue-50/50">
                  <Link href="/auth/login" className="font-medium hover:underline">
                    Prisijunkite
                  </Link>{' '}
                  ir prisidėkite prie pokalbio.
                </div>
              )}

              {user && (
                <div className="flex border-b border-slate-100">
                  {([
                    { key: 'for_you' as const, label: 'Tau' },
                    { key: 'following' as const, label: 'Sekami' },
                    { key: 'latest' as const, label: 'Naujausi' },
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
          {showRightSidebar && <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)] overflow-y-auto">
            {/* Trending */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 uppercase tracking-wider">
                <TrendingUp size={16} className="text-[#E94560]" />
                Tendencijos
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
              <h3 className="mb-3 text-sm font-bold text-slate-900 uppercase tracking-wider">Ką sekti</h3>
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
          </aside>}
        </div>
      </div>
    </div>
  )
}
