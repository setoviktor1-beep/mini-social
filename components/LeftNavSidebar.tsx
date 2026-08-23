'use client'

import Link from 'next/link'
import {
  Home as HomeIcon,
  Search,
  Bell,
  Mail,
  Users,
  Settings,
  Briefcase,
  Store,
  Bookmark,
} from 'lucide-react'
import { useI18n } from '@/lib/i18n'

interface LeftNavSidebarProps {
  userRole?: string | null
  homeHref: string
}

export default function LeftNavSidebar({ userRole, homeHref }: LeftNavSidebarProps) {
  const { t } = useI18n()

  const navItems = [
    { href: homeHref, icon: HomeIcon, label: t('sidebar.home', 'Pagrindinis'), show: true },
    { href: '/services', icon: Store, label: t('sidebar.services', 'Paslaugos'), show: true },
    {
      href: ['pro', 'master', 'admin'].includes(userRole ?? '') ? '/pro' : '/pricing',
      icon: Briefcase,
      label: t('sidebar.pro', 'Verslo darbalaukis'),
      show: true,
    },
    { href: '/search', icon: Search, label: t('sidebar.explore', 'Atrasti'), show: true },
    { href: '/notifications', icon: Bell, label: t('sidebar.notifications', 'Pranešimai'), show: true },
    { href: '/messages', icon: Mail, label: t('sidebar.messages', 'Žinutės'), show: true },
    { href: '/discussions', icon: Users, label: t('sidebar.discussions', 'Diskusijos'), show: true },
    { href: '/bookmarks', icon: Bookmark, label: t('sidebar.bookmarks', 'Išsaugoti'), show: true },
    { href: '/settings', icon: Settings, label: t('sidebar.settings', 'Nustatymai'), show: true },
  ]

  return (
    <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)]">
      <nav className="space-y-1 rounded-2xl border border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 p-2 shadow-sm">
        {navItems
          .filter((item) => item.show)
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all duration-200 hover:translate-x-1 ${
                item.href === homeHref
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-gray-400 hover:bg-slate-50 dark:hover:bg-gray-800/50 hover:text-slate-900 dark:hover:text-gray-100'
              }`}
            >
              <item.icon size={18} strokeWidth={item.href === homeHref ? 2.5 : 1.5} />
              {item.label}
            </Link>
          ))}
      </nav>
    </aside>
  )
}
