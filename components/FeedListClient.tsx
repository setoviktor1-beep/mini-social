'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import PostCard from '@/components/PostCard'
import { createClient } from '@/lib/backend-client'
import { Loader2 } from 'lucide-react'

type TabKey = 'for_you' | 'following' | 'latest'

export default function FeedListClient(props: {
  initialPosts: any[]
  tab: TabKey
  currentUserId?: string
  currentUserRole?: string
}) {
  const { initialPosts, tab, currentUserId, currentUserRole } = props
  const [posts, setPosts] = useState<any[]>(initialPosts || [])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState((initialPosts || []).length === 20)
  const [newPostAvailable, setNewPostAvailable] = useState(false)

  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setPosts(initialPosts || [])
    setPage(0)
    setHasMore((initialPosts || []).length === 20)
    setLoading(false)
    setNewPostAvailable(false)
  }, [tab, initialPosts])

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
      const freshPosts = json.posts || []
      setPosts(freshPosts)
      setPage(0)
      setHasMore(Boolean(json.hasMore))
    } catch (e) {
      // ignore aborts
    } finally {
      setLoading(false)
    }
  }

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return
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
      const newPosts = json.posts || []
      setPosts((prev) => [...prev, ...newPosts])
      setPage(nextPage)
      setHasMore(Boolean(json.hasMore))
    } catch (e) {
      // ignore aborts
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
    <div className="divide-y divide-slate-100 bg-transparent">
      {newPostAvailable && (
        <div className="sticky top-20 z-40 flex justify-center py-3">
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
              ? 'No posts from people you follow yet.'
              : tab === 'for_you'
                ? 'No trending posts in the last 48 hours yet.'
                : 'No posts yet. Start the trend!'}
          </p>
          <p className="text-slate-400 text-xs sm:text-sm">Be the first to share something interesting.</p>
        </div>
      )}

      {posts.length > 0 && (
        <div className="p-4 sm:p-5 text-center">
          <div ref={loadMoreRef} />
          {loading ? (
            <div className="flex items-center justify-center gap-2 text-slate-400 py-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-xs sm:text-sm">Loading more...</span>
            </div>
          ) : hasMore ? (
            <button
              onClick={loadMore}
              className="px-6 py-2.5 rounded-full font-semibold text-sm bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 min-h-[44px] transition-all hover:shadow-sm"
            >
              Load more
            </button>
          ) : (
            <div className="py-4">
              <div className="w-12 h-px bg-slate-200 mx-auto mb-3" />
              <p className="text-xs sm:text-sm text-slate-400">You&apos;re all caught up.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
