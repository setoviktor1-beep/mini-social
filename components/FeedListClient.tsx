'use client'

import { useEffect, useRef, useState } from 'react'
import PostCard from '@/components/PostCard'

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

  const loadMoreRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Reset when tab changes (server will give new initialPosts)
    setPosts(initialPosts || [])
    setPage(0)
    setHasMore((initialPosts || []).length === 20)
    setLoading(false)
  }, [tab, initialPosts])

  const loadMore = async () => {
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
  }

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
  }, [loadMoreRef.current, page, hasMore, loading, tab])

  return (
    <div className="divide-y divide-gray-800/60 bg-transparent">
      {posts.map((post) => (
        <PostCard key={post.feed_key || post.id} post={post} currentUserId={currentUserId} currentUserRole={currentUserRole} />
      ))}

      {posts.length === 0 && (
        <div className="p-8 sm:p-10 text-center text-gray-500 text-sm sm:text-base">
          {tab === 'following'
            ? 'No posts from people you follow yet.'
            : tab === 'for_you'
              ? 'No trending posts in the last 48 hours yet.'
              : 'No posts yet. Start the trend!'}
        </div>
      )}

      {posts.length > 0 && (
        <div className="p-4 sm:p-5 text-center">
          <div ref={loadMoreRef} />
          {loading ? (
            <p className="text-xs sm:text-sm text-gray-400">Loading more...</p>
          ) : hasMore ? (
            <button
              onClick={loadMore}
              className="px-6 py-2.5 rounded-full font-semibold text-sm bg-gray-800 text-gray-200 hover:bg-gray-700 border border-gray-700 min-h-[44px]"
            >
              Load more
            </button>
          ) : (
            <p className="text-xs sm:text-sm text-gray-400">You&apos;re all caught up.</p>
          )}
        </div>
      )}
    </div>
  )
}
