'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Bell, Check } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import Image from 'next/image'

type NotificationType = 'like' | 'comment' | 'follow' | 'new_post' | 'mention' | 'share' | 'repost'
type TargetType = 'post' | 'comment' | 'user' | 'discussion' | null

interface NotificationRow {
  id: string
  user_id: string
  type: NotificationType
  actor_id: string
  target_id: string | null
  target_type: TargetType
  is_read: boolean
  created_at: string
  actor?: {
    username: string
    display_name: string
    avatar_path: string | null
  } | null
}

function formatNotificationText(n: NotificationRow) {
  const name = n.actor?.display_name || 'Someone'
  switch (n.type) {
    case 'like':
      return `${name} liked your post`
    case 'comment':
      return `${name} commented on your post`
    case 'follow':
      return `${name} started following you`
    case 'new_post':
      return `${name} posted something new`
    case 'mention':
      return `${name} mentioned you`
    case 'share':
      return `${name} shared your post`
    case 'repost':
      return `${name} reposted your post`
    default:
      return `${name} sent a notification`
  }
}

function getNotificationHref(n: NotificationRow) {
  if (n.target_type === 'discussion' && n.target_id) return `/discussions/${n.target_id}`
  if (n.actor?.username) return `/u/${n.actor.username}`
  return '/notifications'
}

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), [])
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  const pageSize = 20

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }

  const fetchPage = async (uid: string, offset: number) => {
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(username, display_name, avatar_path)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    return (data as NotificationRow[]) || []
  }

  const refresh = async (uid: string) => {
    setLoading(true)
    const first = await fetchPage(uid, 0)
    setItems(first)
    setHasMore(first.length === pageSize)
    setLoading(false)
  }

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return
    setLoadingMore(true)
    const next = await fetchPage(userId, items.length)
    setItems(prev => [...prev, ...next])
    setHasMore(next.length === pageSize)
    setLoadingMore(false)
  }, [userId, loadingMore, hasMore, items.length])

  const markAllRead = async () => {
    if (!userId) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    await refresh(userId)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null
      setUserId(uid)
      if (!uid) {
        setItems([])
        setHasMore(false)
        setLoading(false)
        return
      }
      refresh(uid)
    })
  }, [supabase])

  useEffect(() => {
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore()
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loadMore])

  if (!userId && !loading) {
    return (
      <div className="p-10 sm:p-16 text-center text-gray-500 dark:text-gray-400">
        <p className="font-bold text-gray-900 dark:text-gray-100 mb-1">Sign in to view notifications</p>
        <Link href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
          Go to login
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Bell size={22} className="text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">Notifications</h1>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold min-h-[44px]"
        >
          <Check size={16} />
          Mark all read
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-10 sm:p-16 text-center text-gray-400 dark:text-gray-500 text-sm">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 sm:p-16 text-center">
            <Bell size={40} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
            <p className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400">No notifications yet</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Likes, comments, mentions and follows will show up here</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((n) => {
              const avatarUrl = getAvatarUrl(n.actor?.avatar_path || null)
              const href = getNotificationHref(n)
              const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true })
              return (
                <Link
                  key={n.id}
                  href={href}
                  className={`w-full flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    n.is_read ? '' : 'bg-blue-50/60 dark:bg-blue-900/10'
                  }`}
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {avatarUrl ? (
                      <div className="relative w-full h-full">
                        <Image src={avatarUrl} alt="" fill sizes="48px" className="object-cover" />
                      </div>
                    ) : (
                      <span className="text-base sm:text-lg font-bold text-blue-200 dark:text-blue-500">
                        {(n.actor?.display_name || n.actor?.username || '?')?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed">
                      {formatNotificationText(n)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo}</p>
                  </div>
                  {!n.is_read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 flex-shrink-0 mt-2" aria-hidden="true" />
                  )}
                </Link>
              )
            })}
            <div ref={loadMoreRef} />
            {loadingMore && (
              <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">Loading more...</div>
            )}
            {!hasMore && (
              <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">You&apos;re all caught up.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
