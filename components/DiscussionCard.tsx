import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Pin } from 'lucide-react'

const categoryConfig: Record<string, { label: string; bg: string; text: string }> = {
  general: { label: 'General', bg: 'bg-blue-50', text: 'text-blue-700' },
  help: { label: 'Help', bg: 'bg-green-50', text: 'text-green-700' },
  offtopic: { label: 'Off-topic', bg: 'bg-gray-100', text: 'text-gray-600' },
  feedback: { label: 'Feedback', bg: 'bg-purple-50', text: 'text-purple-700' },
  news: { label: 'News', bg: 'bg-orange-50', text: 'text-orange-700' },
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
    <div className="p-5 hover:bg-gray-50/50 transition-colors group">
      <div className="flex gap-4">
        {/* Avatar initial */}
        <Link href={`/u/${discussion.profiles?.username}`} className="flex-shrink-0">
          <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
            <span className="text-sm font-bold text-blue-300">
              {discussion.profiles?.display_name?.charAt(0).toUpperCase()}
            </span>
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {discussion.is_pinned && (
              <Pin size={14} className="text-blue-600 flex-shrink-0" />
            )}
            <Link
              href={`/discussions/${discussion.id}`}
              className="font-bold text-gray-900 hover:text-blue-600 transition-colors truncate"
            >
              {discussion.title}
            </Link>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cat.bg} ${cat.text}`}>
              {cat.label}
            </span>
            {discussion.is_locked && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
                Locked
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Link href={`/u/${discussion.profiles?.username}`} className="hover:underline">
              {discussion.profiles?.display_name}
            </Link>
            <span className="text-gray-300">·</span>
            <span>{timeAgo}</span>
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1">
              <MessageSquare size={14} />
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
