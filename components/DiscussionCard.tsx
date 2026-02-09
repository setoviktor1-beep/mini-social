import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Lock, MessageSquare, Pin } from 'lucide-react'

const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
  general: { label: 'General', bg: 'bg-blue-50 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  help: { label: 'Help', bg: 'bg-green-50 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  offtopic: { label: 'Off-topic', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' },
  feedback: { label: 'Feedback', bg: 'bg-purple-50 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  news: { label: 'News', bg: 'bg-orange-50 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
}

interface DiscussionCardProps {
  discussion: {
    id: string
    title: string
    category: string
    is_pinned: boolean
    is_locked: boolean
    created_at: string
    profiles?: { username: string; display_name: string }
    discussion_replies?: { count: number }[]
  }
}

export default function DiscussionCard({ discussion }: DiscussionCardProps) {
  const cat = categoryConfig[discussion.category] || categoryConfig.general
  const replyCount = discussion.discussion_replies?.[0]?.count || 0
  const timeAgo = formatDistanceToNow(new Date(discussion.created_at), { addSuffix: true })

  return (
    <div className="p-3 sm:p-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors group">
      <div className="flex gap-3 sm:gap-4">
        {/* Avatar initial */}
        <Link href={`/u/${discussion.profiles?.username}`} className="flex-shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
            <span className="text-xs sm:text-sm font-bold text-blue-300 dark:text-blue-500">
              {discussion.profiles?.display_name?.charAt(0).toUpperCase()}
            </span>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start sm:items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
            {discussion.is_pinned && (
              <Pin size={14} className="text-blue-600 flex-shrink-0 mt-1 sm:mt-0" />
            )}
            {discussion.is_locked && (
              <Lock size={14} className="text-red-500 flex-shrink-0 mt-1 sm:mt-0" />
            )}
            <Link
              href={`/discussions/${discussion.id}`}
              className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100 hover:text-blue-600 transition-colors break-words"
            >
              {discussion.title}
            </Link>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 ${cat.bg} ${cat.text}`}>
              {cat.label}
            </span>
            {discussion.is_locked && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex-shrink-0">
                Locked
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-500 dark:text-gray-400 flex-wrap">
            <Link href={`/u/${discussion.profiles?.username}`} className="hover:underline">
              {discussion.profiles?.display_name}
            </Link>
            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">&middot;</span>
            <span className="hidden sm:inline">{timeAgo}</span>
            <span className="text-gray-300 dark:text-gray-600 hidden sm:inline">&middot;</span>
            <span className="flex items-center gap-1">
              <MessageSquare size={14} />
              {replyCount}
            </span>
            <span className="sm:hidden text-gray-300 dark:text-gray-600">&middot;</span>
            <span className="sm:hidden">{timeAgo}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
