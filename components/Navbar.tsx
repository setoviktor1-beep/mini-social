'use client'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { User } from '@supabase/supabase-js'
import { useRouter, usePathname } from 'next/navigation'
import { Shield, MessageSquare, MessagesSquare, Search, Menu, X, Settings, Briefcase } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import Image from 'next/image'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [avatarPath, setAvatarPath] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()

  const fetchUnread = useCallback(async (userId: string) => {
    const { data: convos } = await supabase
      .from('conversations')
      .select('id')
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

    if (convos && convos.length > 0) {
      const convoIds = convos.map(c => c.id)
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convoIds)
        .neq('sender_id', userId)
        .eq('is_read', false)
      setUnreadCount(count || 0)
    }
  }, [supabase])

  const fetchUserData = useCallback(async (u: User) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, username, avatar_path')
      .eq('id', u.id)
      .single()
    setRole(profile?.role || 'user')
    setUsername(profile?.username || null)
    setAvatarPath(profile?.avatar_path || null)
    fetchUnread(u.id)
  }, [supabase, fetchUnread])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) fetchUserData(data.user)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUser(session.user)
        fetchUserData(session.user)
        if (event === 'SIGNED_IN') {
          router.refresh()
        }
      } else {
        setUser(null)
        setRole(null)
        setUsername(null)
        setAvatarPath(null)
        setUnreadCount(0)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, fetchUserData, router])

  useEffect(() => {
    if (user) fetchUnread(user.id)
  }, [pathname, user?.id, fetchUnread])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('navbar-messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, (payload: any) => {
        if (payload.new.sender_id !== user.id) {
          setUnreadCount(prev => prev + 1)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, user?.id])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setUsername(null)
    setAvatarPath(null)
    setMobileMenuOpen(false)
    router.refresh()
    router.push('/auth/login')
  }

  const avatarUrl = avatarPath
    ? supabase.storage.from('post-images').getPublicUrl(avatarPath).data.publicUrl
    : null

  const profileHref = `/u/${username || user?.user_metadata?.username || ''}`

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-800/60 bg-[#0a0a0f]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16">
        <Link href="/" className="font-black text-xl sm:text-2xl bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          MiniSocial
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2 text-sm font-bold text-gray-600 dark:text-gray-300">
          <Link href="/search" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors" title="Search">
            <Search size={20} />
          </Link>
          <ThemeToggle />
          {user ? (
            <>
              <Link href="/discussions" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors" title="Discussions">
                <MessageSquare size={20} />
              </Link>
              <Link href="/messages" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors relative" title="Messages">
                <MessagesSquare size={20} />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
              <NotificationBell />
              {(role === 'master' || role === 'admin') && (
                <Link href="/pro" className="p-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500 rounded-lg transition-colors" title="Verslo Darbalaukis">
                  <Briefcase size={20} />
                </Link>
              )}
              {(role === 'admin' || role === 'moderator') && (
                <Link href="/admin/dashboard" className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 rounded-lg transition-colors" title="Admin Panel">
                  <Shield size={20} />
                </Link>
              )}
              <Link href="/settings" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors" title="Settings">
                <Settings size={20} />
              </Link>
              <Link
                href={profileHref}
                className="ml-1 p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Profile"
              >
                <div className="w-7 h-7 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center overflow-hidden">
                  {avatarUrl ? (
                    <div className="relative w-full h-full">
                      <Image src={avatarUrl} alt="" fill sizes="28px" className="object-cover" />
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-blue-300 dark:text-blue-500">
                      {(username || user.user_metadata?.username || '?')?.charAt(0)?.toUpperCase()}
                    </span>
                  )}
                </div>
              </Link>
              <button onClick={signOut} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-all ml-1">Logout</button>
            </>
          ) : (
            <>
              <Link href="/discussions" className="hover:text-blue-600 transition-colors">Discussions</Link>
              <Link href="/auth/login" className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 dark:shadow-blue-900/30 ml-1">
                Login
              </Link>
            </>
          )}
        </div>

        {/* Mobile: icon row + hamburger */}
        <div className="flex md:hidden items-center gap-1">
          <Link href="/search" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors" title="Search">
            <Search size={20} />
          </Link>
          <ThemeToggle />
          {user && (
            <Link href="/messages" className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-500 dark:text-gray-400 hover:text-blue-600 rounded-lg transition-colors relative" title="Messages">
              <MessagesSquare size={20} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )}
          {user && <NotificationBell />}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-600 dark:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-1">
            {user ? (
              <>
                <Link
                  href="/discussions"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors font-medium"
                >
                  <MessageSquare size={20} />
                  Discussions
                </Link>
                <Link
                  href="/messages"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors font-medium"
                >
                  <MessagesSquare size={20} />
                  Messages
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold ml-auto">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                {(role === 'master' || role === 'admin') && (
                  <Link
                    href="/pro"
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-500 transition-colors font-medium"
                  >
                    <Briefcase size={20} />
                    Verslo Darbalaukis
                  </Link>
                )}
                {(role === 'admin' || role === 'moderator') && (
                  <Link
                    href="/admin/dashboard"
                    className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 transition-colors font-medium"
                  >
                    <Shield size={20} />
                    Admin Panel
                  </Link>
                )}
                <Link
                  href={profileHref}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors font-medium"
                >
                  <div className="w-5 h-5 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <div className="relative w-full h-full">
                        <Image src={avatarUrl} alt="" fill sizes="20px" className="object-cover" />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-blue-500">
                        {(username || user.user_metadata?.username || '?')?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  Profile
                </Link>
                <Link
                  href="/settings"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors font-medium"
                >
                  <Settings size={20} />
                  Settings
                </Link>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                  <button
                    onClick={signOut}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 transition-colors font-medium text-left"
                  >
                    Logout
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link
                  href="/discussions"
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-600 transition-colors font-medium"
                >
                  <MessageSquare size={20} />
                  Discussions
                </Link>
                <div className="border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                  <Link
                    href="/auth/login"
                    className="block text-center bg-blue-600 text-white px-6 py-3 rounded-full hover:bg-blue-700 transition-all shadow-sm shadow-blue-200 dark:shadow-blue-900/30 font-bold"
                  >
                    Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
