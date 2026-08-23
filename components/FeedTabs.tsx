'use client'

import Link from 'next/link'
import { useI18n } from '@/lib/i18n'

export type TabKey = 'for_you' | 'following' | 'latest'

interface FeedTabsProps {
  activeTab: TabKey
}

export default function FeedTabs({ activeTab }: FeedTabsProps) {
  const { t } = useI18n()

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'for_you', label: t('tabs.forYou', 'Tau') },
    { key: 'following', label: t('tabs.following', 'Sekami') },
    { key: 'latest', label: t('tabs.latest', 'Naujausi') },
  ]

  return (
    <div className="flex border-b border-slate-100 dark:border-gray-800">
      {tabs.map((tabItem) => {
        const active = activeTab === tabItem.key
        return (
          <Link
            key={tabItem.key}
            href={`/home?tab=${tabItem.key}`}
            className={`relative flex-1 py-3 text-center text-sm font-medium transition-colors hover:bg-slate-50 dark:hover:bg-gray-800/50 ${
              active
                ? 'text-slate-900 dark:text-gray-100'
                : 'text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300'
            }`}
          >
            {tabItem.label}
            {active && (
              <span className="absolute inset-x-8 bottom-0 h-0.5 rounded-full bg-[#E94560]" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
