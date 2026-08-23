'use client'

import Link from 'next/link'
import { TrendingUp } from 'lucide-react'
import WhoToFollowRow from '@/components/WhoToFollowRow'
import { useI18n } from '@/lib/i18n'

interface TrendingSidebarProps {
  trendingRows: Array<{ tag: string; post_count: number }>
  suggestions: any[]
  currentUserId?: string
  followedSuggestionIds: string[]
}

export default function TrendingSidebar({
  trendingRows,
  suggestions,
  currentUserId,
  followedSuggestionIds,
}: TrendingSidebarProps) {
  const { t } = useI18n()
  const followedSet = new Set(followedSuggestionIds)

  return (
    <aside className="hidden lg:block sticky top-20 h-[calc(100vh-90px)] overflow-y-auto">
      {/* Trending */}
      {trendingRows.length > 0 && (
        <div className="rounded-2xl border border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-gray-100 uppercase tracking-wider">
            <TrendingUp size={16} className="text-[#E94560]" />
            {t('sidebar.trending', 'Tendencijos')}
          </h3>
          <div className="space-y-2">
            {trendingRows.map((item) => {
              const postsLabel = `${item.post_count} ${
                item.post_count === 1
                  ? t('sidebar.postCountSingular', 'įrašas')
                  : t('sidebar.postCountPlural', 'įrašai')
              }`
              return (
                <Link
                  key={item.tag}
                  href={`/search?q=%23${encodeURIComponent(item.tag)}`}
                  className="group block rounded-xl px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800/50 transition-all duration-200 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E94560]" />
                    <span className="text-sm font-semibold text-slate-800 dark:text-gray-200 group-hover:text-[#E94560] transition-colors">
                      #{item.tag}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 dark:text-gray-500 ml-3.5">
                    {postsLabel}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Who to follow */}
      {suggestions.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200/80 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-gray-100 uppercase tracking-wider">
            {t('sidebar.whoToFollow', 'Ką sekti')}
          </h3>
          <div className="space-y-3">
            {suggestions.map((s: any) => (
              <WhoToFollowRow
                key={s.id}
                suggestion={s}
                currentUserId={currentUserId}
                initiallyFollowing={followedSet.has(s.id)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
