'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/backend-client'
import { Loader2, Lock, Pin } from 'lucide-react'

export default function DiscussionAdminActions(props: {
  discussionId: string
  initialPinned: boolean
  initialLocked: boolean
  canModerate: boolean
}) {
  const { discussionId, initialPinned, initialLocked, canModerate } = props
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [isPinned, setIsPinned] = useState(initialPinned)
  const [isLocked, setIsLocked] = useState(initialLocked)
  const [loading, setLoading] = useState<'pin' | 'lock' | null>(null)

  if (!canModerate) return null

  const togglePinned = async () => {
    setLoading('pin')
    const next = !isPinned
    const { error } = await supabase
      .from('discussions')
      .update({ is_pinned: next })
      .eq('id', discussionId)
    if (!error) {
      setIsPinned(next)
      router.refresh()
    }
    setLoading(null)
  }

  const toggleLocked = async () => {
    setLoading('lock')
    const next = !isLocked
    const { error } = await supabase
      .from('discussions')
      .update({ is_locked: next })
      .eq('id', discussionId)
    if (!error) {
      setIsLocked(next)
      router.refresh()
    }
    setLoading(null)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={togglePinned}
        disabled={loading !== null}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm border transition-colors min-h-[44px] ${
          isPinned
            ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30'
        } disabled:opacity-60`}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        {loading === 'pin' ? <Loader2 size={16} className="animate-spin" /> : <Pin size={16} />}
        {isPinned ? 'Unpin' : 'Pin'}
      </button>

      <button
        onClick={toggleLocked}
        disabled={loading !== null}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-sm border transition-colors min-h-[44px] ${
          isLocked
            ? 'bg-red-600 text-white border-red-600 hover:bg-red-700'
            : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30'
        } disabled:opacity-60`}
        title={isLocked ? 'Unlock' : 'Lock'}
      >
        {loading === 'lock' ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
        {isLocked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  )
}

