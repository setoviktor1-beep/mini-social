'use client'

import React, { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import AIChatDrawer from './AIChatDrawer'

export default function AIFloatingLauncher() {
  const { t } = useI18n()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Don't show launcher on auth, admin, offline, or dedicated /ai page
  const isExcluded =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/offline') ||
    pathname.startsWith('/legal') ||
    pathname === '/ai'

  if (isExcluded) return null

  return (
    <>
      <aside aria-label="MiniSocial AI">
        <button
          ref={buttonRef}
          type="button"
          data-testid="floating-ai-launcher"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          aria-label={t('ai.assistantTitle', 'MiniSocial AI')}
          title={t('ai.assistantTitle', 'MiniSocial AI')}
          className="group fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 sm:right-6 z-40 flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-tr from-violet-600 via-indigo-600 to-purple-500 text-white shadow-[0_4px_20px_rgba(124,58,237,0.35)] hover:shadow-[0_6px_25px_rgba(124,58,237,0.5)] active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-violet-400 focus-visible:ring-offset-2 transition-all duration-200"
        >
          {/* Subtle pulsating glow effect */}
          <span className="absolute inset-0 rounded-full bg-violet-400 opacity-25 animate-ping duration-1000 group-hover:opacity-40" />

          {/* Sparkles Icon with subtle rotation */}
          <Sparkles className="relative h-6 w-6 sm:h-7 sm:w-7 transition-transform duration-200 group-hover:scale-110" />

          {/* Desktop Tooltip */}
          <span className="pointer-events-none absolute right-full mr-3 hidden sm:group-hover:flex items-center rounded-xl bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-sm whitespace-nowrap animate-in fade-in slide-in-from-right-1 duration-150">
            {t('ai.assistantTitle', 'MiniSocial AI')}
          </span>
        </button>
      </aside>

      <AIChatDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        launcherRef={buttonRef}
      />
    </>
  )
}
