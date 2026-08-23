'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

const STORAGE_KEY = 'cookie-notice-accepted'

export default function CookieNotice() {
  const { t } = useI18n()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // localStorage unavailable — skip the notice rather than crash
    }
  }, [])

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label={t('footer.cookies', 'Slapukai')}
      className="fixed inset-x-0 bottom-16 z-50 mx-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-lg md:bottom-4 dark:border-slate-700 dark:bg-slate-900"
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {t('cookies.text', 'Naudojame tik būtinuosius slapukus prisijungimui ir sesijos saugumui.')}{' '}
        {t('cookies.more', 'Daugiau —')}{' '}
        <Link href="/legal/cookies" className="font-semibold text-blue-600 hover:underline">
          {t('cookies.policy', 'slapukų politikoje')}
        </Link>
        .
      </p>
      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={accept}
          className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          {t('cookies.accept', 'Supratau')}
        </button>
      </div>
    </div>
  )
}
