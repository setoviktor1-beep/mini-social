'use client'

import { Bookmark } from 'lucide-react'
import PostCard from '@/components/PostCard'
import { useI18n } from '@/lib/i18n'

interface BookmarksClientProps {
  posts: any[]
  userId: string
  userRole?: string
}

export default function BookmarksClient({ posts, userId, userRole }: BookmarksClientProps) {
  const { t } = useI18n()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 dark:border-gray-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-50 dark:border-gray-800">
          <h1 className="font-bold text-slate-900 dark:text-gray-100 text-lg sm:text-xl flex items-center gap-2">
            <Bookmark size={18} className="text-amber-500" />
            {t('bookmarks.title', 'Išsaugoti įrašai')}
          </h1>
        </div>

        {posts.map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={userId} currentUserRole={userRole} />
        ))}

        {posts.length === 0 && (
          <div className="p-10 sm:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
              <Bookmark size={28} className="text-slate-300 dark:text-gray-600" />
            </div>
            <p className="text-slate-500 dark:text-gray-400 font-medium">
              {t('bookmarks.empty', 'Dar neturite išsaugotų įrašų.')}
            </p>
            <p className="text-slate-400 dark:text-gray-500 text-sm mt-1">
              {t('bookmarks.emptyHint', 'Paspauskite žymeklio ikoną prie įrašo, kad jį išsaugotumėte.')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
