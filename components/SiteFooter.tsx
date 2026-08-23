'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useI18n } from '@/lib/i18n'

const appPathPrefixes = [
  '/admin',
  '/bookmarks',
  '/dashboard',
  '/discussions',
  '/home',
  '/messages',
  '/moderation',
  '/my-orders',
  '/notifications',
  '/posts',
  '/pro',
  '/search',
  '/services',
  '/settings',
  '/u',
  '/wallet',
]

export default function SiteFooter() {
  const { t } = useI18n()
  const pathname = usePathname()
  const isAppPage =
    pathname === '/' ||
    appPathPrefixes.some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )

  if (isAppPage) return null

  return (
    <footer className="mx-auto w-full max-w-7xl border-t border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
      <nav aria-label="Teisinė informacija" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <Link href="/legal/privacy" className="transition-colors hover:text-blue-600">
          {t('footer.privacy', 'Privatumas')}
        </Link>
        <Link href="/legal/terms" className="transition-colors hover:text-blue-600">
          {t('footer.terms', 'Taisyklės')}
        </Link>
        <Link href="/legal/cookies" className="transition-colors hover:text-blue-600">
          {t('footer.cookies', 'Slapukai')}
        </Link>
        <Link href="/legal/contact" className="transition-colors hover:text-blue-600">
          {t('footer.contact', 'Kontaktai')}
        </Link>
      </nav>
      <p className="mt-3 text-xs text-slate-400">&copy; 2026 MiniSocial</p>
    </footer>
  )
}
