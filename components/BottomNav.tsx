'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Store, Search, MessagesSquare, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/backend-client'

export default function BottomNav() {
  const pathname = usePathname()
  const [username, setUsername] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        setLoggedIn(false)
        setUsername(null)
        setUnread(0)
        return
      }
      setLoggedIn(true)

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', data.user.id)
        .single()
      setUsername(profile?.username || null)

      // Count unread messages
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${data.user.id},user2_id.eq.${data.user.id}`)
      if (convos?.length) {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convos.map(c => c.id))
          .neq('sender_id', data.user.id)
          .eq('is_read', false)
        setUnread(count || 0)
      }
    })
  }, [pathname])

  // Don't render on admin/auth pages
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/offline')
  ) {
    return null
  }

  const profileHref = username ? `/u/${username}` : loggedIn ? '/settings' : '/auth/login'
  const homeHref = loggedIn ? '/home' : '/'

  const tabs = [
    { href: homeHref, icon: Home, label: 'Pradžia' },
    { href: '/services', icon: Store, label: 'Paslaugos' },
    { href: '/search', icon: Search, label: 'Paieška' },
    { href: '/messages', icon: MessagesSquare, label: 'Žinutės', badge: unread },
    { href: profileHref, icon: User, label: 'Profilis', matchPrefix: '/u/' },
  ]

  function isActive(tab: typeof tabs[0]) {
    if (tab.href === '/home') return pathname === '/home' || pathname === '/'
    if (tab.href === '/') return pathname === '/'
    if (tab.matchPrefix) return pathname.startsWith(tab.matchPrefix)
    return pathname.startsWith(tab.href)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-gray-800 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-stretch h-16 mb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-all duration-200 relative min-h-[44px] ${
                active ? 'text-[#E94560]' : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                {tab.badge != null && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-[#E94560] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {tab.badge > 9 ? '9+' : tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium leading-tight">{tab.label}</span>
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-[#E94560] rounded-full" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
