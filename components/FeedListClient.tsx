'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PostCard from '@/components/PostCard'
import { createClient } from '@/lib/backend-client'
import { WifiOff, RotateCw } from 'lucide-react'
import { SkeletonCard } from '@/components/Skeleton'

type TabKey = 'for_you' | 'following' | 'latest'

function dedupePosts(items: any[]) {
  const seenIds = new Set<string>()
  const seenFeedKeys = new Set<string>()

  return items.filter((post) => {
    const id = typeof post?.id === 'string' ? post.id : ''
    const feedKey = typeof post?.feed_key === 'string' ? post.feed_key : ''
    if ((id && seenIds.has(id)) || (feedKey && seenFeedKeys.has(feedKey))) return false
    if (id) seenIds.add(id)
    if (feedKey) seenFeedKeys.add(feedKey)
    return true
  })
}

function appendUniquePosts(existing: any[], incoming: any[]) {
  const result = [...existing]
  const seenIds = new Set(existing.map((post) => post?.id).filter(Boolean))
  const seenFeedKeys = new Set(existing.map((post) => post?.feed_key).filter(Boolean))

  for (const post of incoming) {
    if (post?.id && seenIds.has(post.id)) continue
    if (post?.feed_key && seenFeedKeys.has(post.feed_key)) continue
    if (post?.id) seenIds.add(post.id)
    if (post?.feed_key) seenFeedKeys.add(post.feed_key)
    result.push(post)
  }

  return result
}

export default function FeedListClient(props: {
  initialPosts: any[]
  tab: TabKey
  currentUserId?: string
  currentUserRole?: string
}) {
  const { initialPosts, tab, currentUserId, currentUserRole } = props
  const [posts, setPosts] = useState<any[]>(() => dedupePosts(initialPosts || []))
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState((initialPosts || []).length === 20)
  const [newPostAvailable, setNewPostAvailable] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [isOffline, setIsOffline] = useState(false)

  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setPosts(dedupePosts(initialPosts || []))
    setPage(0)
    setHasMore((initialPosts || []).length === 20)
    setLoading(false)
    setNewPostAvailable(false)
  }, [tab, initialPosts])

  useEffect(() => {
    if (typeof navigator !== 'undefined') setIsOffline(!navigator.onLine)
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('public:posts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (_payload: any) => {
          setNewPostAvailable(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const reloadFeed = async () => {
    setNewPostAvailable(false)
    setLoadError(false)
    setLoading(true)
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const res = await fetch(`/api/feed?tab=${encodeURIComponent(tab)}&page=0`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Failed to fetch feed')
      const json = await res.json()
      const freshPosts = dedupePosts(json.posts || [])
      setPosts(freshPosts)
      setPage(0)
      setHasMore(Boolean(json.hasMore))
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setLoadError(true)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
    setLoadError(false)
    setLoading(true)
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const nextPage = page + 1
      const res = await fetch(`/api/feed?tab=${encodeURIComponent(tab)}&page=${nextPage}`, {
        signal: controller.signal,
      })
      if (!res.ok) throw new Error('Failed to fetch feed')
      const json = await res.json()
      const newPosts = dedupePosts(json.posts || [])
      setPosts((prev) => appendUniquePosts(prev, newPosts))
      setPage(nextPage)
      setHasMore(Boolean(json.hasMore))
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [hasMore, loading, page, tab])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '300px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  return (
    <div className="divide-y divide-slate-100 bg-transparent" role="feed" aria-busy={loading}>
      {isOffline && (
        <div role="status" className="flex items-center justify-center gap-2 bg-amber-50 px-4 py-2.5 text-xs sm:text-sm font-medium text-amber-700">
          <WifiOff size={14} />
          Nėra interneto ryšio. Rodomi anksčiau įkelti įrašai.
        </div>
      )}

      {newPostAvailable && (
        <div role="status" className="sticky top-20 z-40 flex justify-center py-3">
          <button
            onClick={reloadFeed}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm bg-[#1A1A2E] hover:bg-[#16213E] text-white shadow-lg transition-all active:scale-95 animate-in slide-in-from-top-2 duration-300"
          >
            Naujas įrašas ↑
          </button>
        </div>
      )}

      {posts.map((post) => (
        <PostCard key={post.feed_key || post.id} post={post} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      ))}

      {posts.length === 0 && (
        <div className="p-8 sm:p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-slate-500 text-sm sm:text-base font-medium mb-1">
            {tab === 'following'
              ? 'Sekami žmonės dar nieko nepaskelbė.'
              : tab === 'for_you'
                ? 'Per pastarąsias 48 valandas populiarių įrašų dar nėra.'
                : 'Įrašų dar nėra. Pradėkite pokalbį!'}
          </p>
          <p className="text-slate-400 text-xs sm:text-sm">Pasidalinkite kuo nors įdomiu pirmieji.</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3 p-4 sm:p-5" aria-hidden="true">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && loadError && (
        <div role="alert" className="flex flex-col items-center gap-3 p-6 sm:p-8 text-center">
          <p className="text-sm text-slate-500">Nepavyko įkelti įrašų. Patikrinkite ryšį ir bandykite dar kartą.</p>
          <button
            onClick={posts.length === 0 ? reloadFeed : loadMore}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 min-h-[44px] transition-all"
          >
            <RotateCw size={16} />
            Bandyti dar kartą
          </button>
        </div>
      )}

      {posts.length > 0 && !loading && (
        <div className="p-4 sm:p-5 text-center">
          <div ref={loadMoreRef} />
          {!loadError && (hasMore ? (
            <button
              onClick={loadMore}
              className="px-6 py-2.5 rounded-full font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 min-h-[44px] transition-all hover:shadow-sm"
            >
              Rodyti daugiau
            </button>
          ) : (
            <div className="py-4">
              <div className="w-12 h-px bg-slate-200 mx-auto mb-3" />
              <p className="text-xs sm:text-sm text-slate-400">Peržiūrėjote visus įrašus.</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
