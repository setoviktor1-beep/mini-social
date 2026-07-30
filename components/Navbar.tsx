'use client'
import Link from 'next/link'
import { createClient } from '@/lib/backend-client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Shield, MessageSquare, MessagesSquare, Search, Menu, X, Settings, Briefcase, ClipboardList } from 'lucide-react'
import ThemeToggle from './ThemeToggle'
import NotificationBell from './NotificationBell'
import PushNotificationToggle from './PushNotificationToggle'
import LanguageSwitcher from './LanguageSwitcher'
import Image from 'next/image'
import { useI18n } from '@/lib/i18n'

type User = {
  id: string
  email: string
  name?: string
  image?: string | null
  user_metadata?: {
    username?: string
    [key: string]: unknown
  }
}

export default function Navbar() {
  const { t } = useI18n()
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
  }, [pathname, user, fetchUnread])

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
  }, [supabase, user])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setRole(null)
    setUsername(null)
    setAvatarPath(null)
    setMobileMenuOpen(false)
    router.replace('/auth/login')
    router.refresh()
  }

  const avatarUrl = avatarPath
    ? supabase.storage.from('post-images').getPublicUrl(avatarPath).data.publicUrl
    : null

  const homeHref = user ? '/home' : '/'
  const profileHref = username || user?.user_metadata?.username
    ? `/u/${username || user?.user_metadata?.username}`
    : '/settings'
  const isProUser = role === 'master' || role === 'admin' || role === 'pro'
  const isFeedPage = pathname === '/' || pathname === '/home'

  const isActive = (href: string) => {
    if (href === '/home' || href === '/') {
      return pathname === '/home' || pathname === '/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:h-16">
        {/* Logo */}
        <Link href={homeHref} className="font-black text-xl sm:text-2xl bg-gradient-to-r from-[#1A1A2E] to-[#E94560] bg-clip-text text-transparent hover:opacity-80 transition-opacity">
          MiniSocial
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1 text-sm font-medium">
          <LanguageSwitcher />
          {!isFeedPage && (
            <Link href="/search" className={`p-2.5 rounded-xl transition-all duration-200 ${isActive('/search') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Paieška" aria-label="Paieška">
              <Search size={20} strokeWidth={isActive('/search') ? 2.5 : 1.5} />
            </Link>
          )}
          <ThemeToggle />
          {user ? (
            <>
              {!isFeedPage && (
                <>
                  <Link href="/discussions" className={`p-2.5 rounded-xl transition-all duration-200 ${isActive('/discussions') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Diskusijos" aria-label="Diskusijos">
                    <MessageSquare size={20} strokeWidth={isActive('/discussions') ? 2.5 : 1.5} />
                  </Link>
                  <Link href="/messages" className={`relative p-2.5 rounded-xl transition-all duration-200 ${isActive('/messages') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Žinutės" aria-label="Žinutės">
                    <MessagesSquare size={20} strokeWidth={isActive('/messages') ? 2.5 : 1.5} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-[#E94560] text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold animate-pulse">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Link>
                  <NotificationBell />
                  {!isProUser && (
                    <Link href="/my-orders" className={`p-2.5 rounded-xl transition-all duration-200 ${isActive('/my-orders') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Mano užsakymai" aria-label="Mano užsakymai">
                      <ClipboardList size={20} />
                    </Link>
                  )}
                  {isProUser ? (
                    <Link href="/pro" className={`flex items-center gap-1 rounded-xl p-2.5 transition-all duration-200 ${isActive('/pro') ? 'bg-emerald-50 text-emerald-600' : 'text-emerald-600 hover:bg-emerald-50'}`} title="Verslo darbalaukis" aria-label="Verslo darbalaukis">
                      <Briefcase size={20} />
                    </Link>
                  ) : (
                    <Link href="/pricing" className={`flex items-center gap-1 rounded-xl p-2 text-xs font-semibold transition-all duration-200 ${isActive('/pricing') ? 'bg-emerald-50 text-emerald-600' : 'text-emerald-600 hover:bg-emerald-50'}`} title="Verslo planai" aria-label="Verslo planai">
                      <Briefcase size={20} />
                      <span className="hidden xl:inline">Pro</span>
                    </Link>
                  )}
                  <Link href="/settings" className={`p-2.5 rounded-xl transition-all duration-200 ${isActive('/settings') ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`} title="Nustatymai" aria-label="Nustatymai">
                    <Settings size={20} strokeWidth={isActive('/settings') ? 2.5 : 1.5} />
                  </Link>
                </>
              )}
              {(role === 'admin' || role === 'moderator') && (
                <Link href="/admin/dashboard" className="p-2.5 hover:bg-red-50 text-red-500 rounded-xl transition-all duration-200" title="Administravimas" aria-label="Administravimas">
                  <Shield size={20} />
                </Link>
              )}
              <Link
                href={profileHref}
                className="ml-1 p-1.5 rounded-xl hover:bg-slate-50 transition-all duration-200 min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Profilis"
                aria-label="Profilis"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center overflow-hidden ring-2 ring-white shadow-sm">
                  {avatarUrl ? (
                    <div className="relative w-full h-full">
                      <Image src={avatarUrl} alt="" fill sizes="32px" className="object-cover" />
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-blue-600">
                      {(username || user.user_metadata?.username || '?')?.charAt(0)?.toUpperCase()}
                    </span>
                  )}
                </div>
              </Link>
              <button onClick={signOut} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-full hover:bg-slate-200 transition-all duration-200 text-sm font-medium ml-1">Atsijungti</button>
            </>
          ) : (
            <>
              <Link href="/discussions" className="text-slate-600 hover:text-slate-900 transition-colors px-3">Diskusijos</Link>
              <Link href="/auth/login" className="bg-[#1A1A2E] text-white px-6 py-2.5 rounded-full hover:bg-[#16213E] transition-all duration-200 shadow-sm text-sm font-semibold ml-1">
                Prisijungti
              </Link>
            </>
          )}
        </div>

        {/* Mobile: minimal icon row + hamburger */}
        <div className="flex md:hidden items-center gap-1">
          <ThemeToggle />
          {user && <NotificationBell />}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 hover:bg-slate-100 rounded-xl transition-all duration-200 text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={mobileMenuOpen ? 'Uždaryti meniu' : 'Atverti meniu'}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white/95 backdrop-blur-md shadow-lg">
          <div className="max-w-2xl mx-auto px-4 py-3 space-y-1">
            {user ? (
              <>
                <Link href="/discussions" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-medium">
                  <MessageSquare size={20} />
                  {t('nav.feed')}
                </Link>
                <Link href="/messages" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-medium">
                  <MessagesSquare size={20} />
                  {t('nav.messages')}
                  {unreadCount > 0 && (
                    <span className="bg-[#E94560] text-white text-xs px-2 py-0.5 rounded-full font-bold ml-auto">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                {!isProUser && (
                  <Link href="/my-orders" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-medium">
                    <ClipboardList size={20} />
                    Mano užsakymai
                  </Link>
                )}
                {isProUser ? (
                  <Link href="/pro" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50 text-emerald-600 transition-colors font-medium">
                    <Briefcase size={20} />
                    Verslo darbalaukis
                  </Link>
                ) : (
                  <Link href="/pricing" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-emerald-50 text-emerald-600 transition-colors font-medium">
                    <Briefcase size={20} />
                    Verslo planai
                  </Link>
                )}
                {(role === 'admin' || role === 'moderator') && (
                  <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 text-red-500 transition-colors font-medium">
                    <Shield size={20} />
                    Administravimas
                  </Link>
                )}
                <Link href={profileHref} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-medium">
                  <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center overflow-hidden">
                    {avatarUrl ? (
                      <div className="relative w-full h-full">
                        <Image src={avatarUrl} alt="" fill sizes="24px" className="object-cover" />
                      </div>
                    ) : (
                      <span className="text-xs font-bold text-blue-600">
                        {(username || user.user_metadata?.username || '?')?.charAt(0)?.toUpperCase()}
                      </span>
                    )}
                  </div>
                  {t('nav.profile')}
                </Link>
                <Link href="/settings" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-medium">
                  <Settings size={20} />
                  {t('nav.settings')}
                </Link>
                <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100 mt-2 pt-2 gap-3">
                  <LanguageSwitcher />
                  <PushNotificationToggle />
                </div>
                <div className="pt-1">
                  <button onClick={signOut} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors font-medium text-left">
                    {t('nav.logout')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Link href="/discussions" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors font-medium">
                  <MessageSquare size={20} />
                  {t('nav.feed')}
                </Link>
                <div className="border-t border-slate-100 pt-2 mt-2">
                  <Link href="/auth/login" className="block text-center bg-[#1A1A2E] text-white px-6 py-3 rounded-full hover:bg-[#16213E] transition-all shadow-sm font-bold">
                    {t('nav.login')}
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
