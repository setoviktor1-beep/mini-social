'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import Image from 'next/image'

type NotificationType = 'like' | 'comment' | 'follow' | 'new_post'
type TargetType = 'post' | 'comment' | 'user' | null

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
    default:
      return `${name} sent a notification`
  }
}

export default function NotificationBell() {
  const supabase = useMemo(() => createClient(), [])
  const rootRef = useRef<HTMLDivElement | null>(null)

  const [open, setOpen] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [items, setItems] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const getAvatarUrl = (path: string | null) => {
    if (!path) return null
    return supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl
  }

  const fetchUnreadCount = async (uid: string) => {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid)
      .eq('is_read', false)
    setUnreadCount(count || 0)
  }

  const fetchLatest = async (uid: string) => {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*, actor:actor_id(username, display_name, avatar_path)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    setItems((data as NotificationRow[]) || [])
    setLoading(false)
  }

  const markAllRead = async () => {
    if (!userId) return
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)
    await fetchLatest(userId)
    await fetchUnreadCount(userId)
  }

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null
      setUserId(uid)
      if (uid) {
        fetchLatest(uid)
        fetchUnreadCount(uid)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id || null
      setUserId(uid)
      if (!uid) {
        setItems([])
        setUnreadCount(0)
        setOpen(false)
        return
      }
      fetchLatest(uid)
      fetchUnreadCount(uid)
      if (event === 'SIGNED_IN') setOpen(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel('navbar-notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, async () => {
        await fetchLatest(userId)
        await fetchUnreadCount(userId)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return
      const el = rootRef.current
      if (!el) return
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  if (!userId) return null

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors relative min-w-[44px] min-h-[44px] flex items-center justify-center"
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-800 overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
            <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">Notifications</p>
            <button
              onClick={markAllRead}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] px-2"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-[360px] overflow-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">Loading...</div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-400 dark:text-gray-500">No notifications yet.</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((n) => {
                  const href = n.actor?.username ? `/u/${n.actor.username}` : '/notifications'
                  const avatarUrl = getAvatarUrl(n.actor?.avatar_path || null)
                  return (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors ${
                        n.is_read ? '' : 'bg-blue-50/60 dark:bg-blue-900/10'
                      }`}
                    >
                      <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {avatarUrl ? (
                          <div className="relative w-full h-full">
                            <Image src={avatarUrl} alt="" fill sizes="36px" className="object-cover" />
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-blue-300 dark:text-blue-500">
                            {(n.actor?.display_name || n.actor?.username || '?')?.charAt(0)?.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 dark:text-gray-200 leading-snug">
                          {formatNotificationText(n)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-2" aria-hidden="true" />
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline min-h-[44px] leading-[44px]"
            >
              View all
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
