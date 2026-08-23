// app/page.tsx
import { createClient } from '@/lib/backend-server'
import PostComposer from '@/components/PostComposer'
import Link from 'next/link'
import FeedListClient from '@/components/FeedListClient'
import LandingPage from '@/components/LandingPage'
import LeftNavSidebar from '@/components/LeftNavSidebar'
import FeedTabs from '@/components/FeedTabs'
import TrendingSidebar from '@/components/TrendingSidebar'
import { attachUserInteractionFlags, getFeedItems, parseTab, type TabKey } from '@/lib/feed-service'

export const dynamic = 'force-dynamic'

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

  // Both computed server-side against the full posts/profiles tables
  const [{ data: trendingRaw }, { data: suggestionsRaw }] = await Promise.all([
    supabase.rpc('get_trending_hashtags', { p_limit: 4, p_window_hours: 168 }),
    supabase.rpc('get_follow_suggestions', { p_limit: 3 }),
  ])

  const trendingRows = (trendingRaw || []) as Array<{ tag: string; post_count: number }>
  const suggestions = suggestionsRaw || []
  const followedSuggestionIds: string[] = []
  const showRightSidebar = trendingRows.length > 0 || suggestions.length > 0

  return (
    <div className="relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] min-h-[calc(100dvh-6rem)] w-screen bg-[#F8F9FA] dark:bg-[#0b1120] text-slate-800 dark:text-gray-200">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 pb-24 md:pb-8">
        <div
          className={`grid grid-cols-1 gap-4 ${
            showRightSidebar
              ? 'lg:grid-cols-[240px_minmax(0,1fr)_300px]'
              : 'lg:grid-cols-[240px_minmax(0,1fr)]'
          }`}
        >
          {/* LEFT SIDEBAR */}
          <LeftNavSidebar userRole={userRole} homeHref={homeHref} />

          {/* MAIN FEED */}
          <main className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
              {user ? (
                <div id="post-composer" className="scroll-mt-20">
                  <PostComposer userId={user.id} />
                </div>
              ) : (
                <div className="border-b border-slate-100 dark:border-gray-800 p-4 text-sm text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20">
                  <Link href="/auth/login" className="font-medium hover:underline">
                    Prisijunkite
                  </Link>{' '}
                  ir prisidėkite prie pokalbio.
                </div>
              )}

              {user && <FeedTabs activeTab={activeTab} />}

              <FeedListClient
                initialPosts={postsWithLikeStatus}
                tab={activeTab}
                currentUserId={user?.id}
                currentUserRole={userRole}
              />
            </div>
          </main>

          {/* RIGHT SIDEBAR */}
          {showRightSidebar && (
            <TrendingSidebar
              trendingRows={trendingRows}
              suggestions={suggestions}
              currentUserId={user?.id}
              followedSuggestionIds={followedSuggestionIds}
            />
          )}
        </div>
      </div>
    </div>
  )
}
