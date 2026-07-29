'use client'

import { useMemo, useRef, useState, useTransition } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'
import { notifyMentions } from '@/lib/mentions'

interface DiscussionReplyFormProps {
  discussionId: string
  userId: string
}

export default function DiscussionReplyForm({ discussionId, userId }: DiscussionReplyFormProps) {
  // UX5: Memoize supabase client to prevent recreation on every render
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [, startTransition] = useTransition()
  const submitLockRef = useRef(false)

  const handleSubmit = async () => {
    const trimmed = content.trim()
    if (!trimmed || loading || submitLockRef.current) return

    submitLockRef.current = true
    setLoading(true)
    const { error } = await supabase.from('discussion_replies').insert({
      discussion_id: discussionId,
      user_id: userId,
      content: trimmed,
    }).select('id').single()

    if (!error) {
      await notifyMentions({
        supabase,
        content: trimmed,
        actorId: userId,
        targetId: discussionId,
        targetType: 'discussion',
      })

      setContent('')
      // UX5: Use startTransition for router.refresh() to avoid interrupting
      // the current render cycle and unexpectedly clearing in-flight state
      startTransition(() => {
        router.refresh()
      })
    }
    setLoading(false)
    submitLockRef.current = false
  }

  return (
    <form
      className="p-5"
      onSubmit={(e) => {
        e.preventDefault()
        void handleSubmit()
      }}
    >
      <div className="flex gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          placeholder="Parašykite atsakymą..."
          maxLength={2000}
          rows={3}
          className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-colors resize-none bg-white dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <p className="text-xs text-gray-400 dark:text-gray-500">{content.length}/2000 &middot; Atsakyti mygtuku arba Ctrl/Cmd+Enter</p>
        <button
          type="submit"
          disabled={loading || !content.trim()}
          className="bg-blue-600 text-white px-5 py-2 rounded-full font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm shadow-blue-200 dark:shadow-blue-900/30"
        >
          {loading ? (
            'Siunčiama...'
          ) : (
            <>
              <Send size={14} />
              Atsakyti
            </>
          )}
        </button>
      </div>
    </form>
  )
}
