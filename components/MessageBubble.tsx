'use client'
import { formatDistanceToNow } from 'date-fns'

interface MessageBubbleProps {
  content: string
  created_at: string
  isOwn: boolean
}

export default function MessageBubble({ content, created_at, isOwn }: MessageBubbleProps) {
  const timeAgo = formatDistanceToNow(new Date(created_at), { addSuffix: true })

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2 sm:py-2.5 ${
        isOwn
          ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-2xl rounded-bl-md'
      }`}>
        <p className="text-sm sm:text-[15px] leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        <p className={`text-[11px] mt-1 ${
          isOwn ? 'text-blue-200' : 'text-gray-400 dark:text-gray-500'
        }`}>
          {timeAgo}
        </p>
      </div>
    </div>
  )
}
