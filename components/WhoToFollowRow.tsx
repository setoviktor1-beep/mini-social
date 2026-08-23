'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/backend-client'

interface WhoToFollowRowProps {
  suggestion: {
    id: string
    username: string
    display_name: string | null
    avatar_path?: string | null
  }
  currentUserId?: string
  initiallyFollowing?: boolean
}

import { useI18n } from '@/lib/i18n'

export default function WhoToFollowRow({ suggestion, currentUserId, initiallyFollowing = false }: WhoToFollowRowProps) {
  const { t } = useI18n()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [following, setFollowing] = useState(initiallyFollowing)
  const [loading, setLoading] = useState(false)

  const avatarUrl = suggestion.avatar_path
    ? supabase.storage.from('post-images').getPublicUrl(suggestion.avatar_path).data.publicUrl
    : null

  const handleFollow = async () => {
    if (!currentUserId || loading) {
      if (!currentUserId) router.push(`/u/${suggestion.username}`)
      return
    }

    setLoading(true)

    if (following) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', suggestion.id)

      if (!error) setFollowing(false)
      setLoading(false)
      return
    }

    const { error } = await supabase.from('follows').upsert({
      follower_id: currentUserId,
      following_id: suggestion.id,
    }, {
      onConflict: 'follower_id,following_id',
      ignoreDuplicates: true,
    })

    if (!error) {
      setFollowing(true)

      if (suggestion.id !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: suggestion.id,
          actor_id: currentUserId,
          type: 'follow',
          target_id: currentUserId,
          target_type: 'user',
        })
      }
    }

    setLoading(false)
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between gap-3 group">
      <Link href={`/u/${suggestion.username}`} className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 hover:bg-slate-50 transition-colors">
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-blue-50 ring-2 ring-white shadow-sm">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-blue-600">
              {(suggestion.display_name || suggestion.username).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
            {suggestion.display_name || suggestion.username}
          </div>
          <div className="truncate text-xs text-slate-400">@{suggestion.username}</div>
        </div>
      </Link>
      <button
        type="button"
        onClick={handleFollow}
        disabled={loading}
        className={`min-h-[32px] rounded-full px-4 py-1 text-xs font-semibold transition-all duration-200 disabled:opacity-60 ${
          following
            ? 'border border-slate-300 text-slate-600 hover:border-red-400 hover:text-red-500 hover:bg-red-50'
            : 'bg-[#1A1A2E] text-white hover:bg-[#16213E] hover:shadow-md'
        }`}
      >
        {loading ? '...' : following ? t('sidebar.following', 'Sekama') : t('sidebar.follow', 'Sekti')}
      </button>
    </div>
  )
}
