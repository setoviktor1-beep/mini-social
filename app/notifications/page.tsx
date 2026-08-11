'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/backend-client'
import { Bell, Check, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { lt } from 'date-fns/locale'
import Image from 'next/image'
import {
  formatNotificationText,
  getNotificationHref,
  type NotificationRow,
} from '@/lib/notification-display'

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), [])
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const pageSize = 20

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }

  const fetchPage = useCallback(async (uid: string, offset: number) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(username, display_name, avatar_path)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error
    return (data as NotificationRow[]) || []
  }, [supabase])

  const refresh = useCallback(async (uid: string) => {
    setLoading(true)
    setLoadError(false)
    try {
      const first = await fetchPage(uid, 0)
      setItems(first)
      setHasMore(first.length === pageSize)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return
    setLoadingMore(true)
    setLoadError(false)
    try {
      const next = await fetchPage(userId, items.length)
      setItems(prev => [...prev, ...next])
      setHasMore(next.length === pageSize)
    } catch {
      setLoadError(true)
    } finally {
      setLoadingMore(false)
    }
  }, [userId, loadingMore, hasMore, items.length, fetchPage])

  const [respondingTo, setRespondingTo] = useState<string | null>(null)

  const respondToFollowRequest = async (notification: NotificationRow, accept: boolean) => {
    if (!userId || respondingTo) return
    setRespondingTo(notification.id)
    // Server-enforced regardless of this UI: only the target may update
    // status (follow_requests_target_update RLS policy), and accepting
    // materializes the actual `follows` row via a trigger — see
    // db/migrations/0013_private_accounts.sql.
    const { error } = await supabase
      .from('follow_requests')
      .update({ status: accept ? 'accepted' : 'rejected' })
      .eq('requester_id', notification.actor_id)
      .eq('target_id', userId)
    if (!error) {
      if (accept) {
        await supabase.from('notifications').insert({
          user_id: notification.actor_id,
          actor_id: userId,
          type: 'follow_request_accepted',
          target_id: userId,
          target_type: 'user',
        })
      }
      setItems((prev) => prev.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)))
    }
    setRespondingTo(null)
  }

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
  }, [supabase, refresh])

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
        <p className="font-bold text-gray-900 dark:text-gray-100 mb-1">Prisijunkite, kad matytumėte pranešimus</p>
        <Link href="/auth/login" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">
          Prisijungti
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Bell size={22} className="text-blue-600" />
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-gray-100">Pranešimai</h1>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors font-bold min-h-[44px]"
        >
          <Check size={16} />
          Pažymėti perskaitytais
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <div className="p-10 sm:p-16 text-center text-gray-400 dark:text-gray-500 text-sm">
            Kraunama...
          </div>
        ) : loadError && items.length === 0 ? (
          <div role="alert" className="p-10 sm:p-16 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Nepavyko įkelti pranešimų.</p>
            <button
              onClick={() => userId && refresh(userId)}
              className="px-5 py-2.5 rounded-full font-semibold text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 min-h-[44px] transition-all"
            >
              Bandyti dar kartą
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 sm:p-16 text-center">
            <Bell size={40} className="mx-auto mb-3 text-gray-200 dark:text-gray-700" />
            <p className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400">Pranešimų dar nėra</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Čia matysite patiktukus, komentarus, paminėjimus ir naujus sekėjus</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((n) => {
              const avatarUrl = getAvatarUrl(n.actor?.avatar_path || null)
              const href = getNotificationHref(n)
              const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: lt })
              const avatarEl = avatarUrl ? (
                <div className="relative w-full h-full">
                  <Image src={avatarUrl} alt="" fill sizes="48px" className="object-cover" />
                </div>
              ) : (
                <span className="text-base sm:text-lg font-bold text-blue-200 dark:text-blue-500">
                  {(n.actor?.display_name || n.actor?.username || '?')?.charAt(0)?.toUpperCase()}
                </span>
              )

              // Actionable inline (not a plain link) — a <button> nested
              // inside an <a> isn't valid HTML/accessible, so this is a
              // <div> with its own Link (avatar/name) plus separate
              // accept/reject buttons, instead of the whole row being one link.
              if (n.type === 'follow_request' && !n.is_read) {
                return (
                  <div key={n.id} className="flex items-start gap-3 sm:gap-4 p-3 sm:p-4 bg-blue-50/60 dark:bg-blue-900/10">
                    <Link href={href} className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {avatarEl}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-[15px] text-gray-800 dark:text-gray-200 leading-relaxed">
                        {formatNotificationText(n)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 mb-2">{timeAgo}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => respondToFollowRequest(n, true)}
                          disabled={respondingTo === n.id}
                          className="px-4 py-2 rounded-full text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 min-h-[36px] transition-colors"
                        >
                          Priimti
                        </button>
                        <button
                          type="button"
                          onClick={() => respondToFollowRequest(n, false)}
                          disabled={respondingTo === n.id}
                          aria-label="Atmesti sekimo užklausą"
                          className="px-4 py-2 rounded-full text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 min-h-[36px] transition-colors flex items-center gap-1"
                        >
                          <X size={14} />
                          Atmesti
                        </button>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <Link
                  key={n.id}
                  href={href}
                  className={`w-full flex items-start gap-3 sm:gap-4 p-3 sm:p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                    n.is_read ? '' : 'bg-blue-50/60 dark:bg-blue-900/10'
                  }`}
                >
                  <div className="w-11 h-11 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {avatarEl}
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
              <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">Kraunama...</div>
            )}
            {loadError && items.length > 0 && (
              <div role="alert" className="p-4 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">Nepavyko įkelti daugiau pranešimų.</p>
                <button
                  onClick={loadMore}
                  className="px-4 py-2 rounded-full font-semibold text-xs bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 min-h-[36px] transition-all"
                >
                  Bandyti dar kartą
                </button>
              </div>
            )}
            {!hasMore && !loadError && (
              <div className="p-4 text-center text-xs text-gray-400 dark:text-gray-500">Peržiūrėjote visus pranešimus.</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
