'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase'

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

export default function WhoToFollowRow({ suggestion, currentUserId, initiallyFollowing = false }: WhoToFollowRowProps) {
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
    <div className="flex items-center justify-between gap-3">
      <Link href={`/u/${suggestion.username}`} className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 hover:bg-gray-800/40">
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-blue-900/30">
          {avatarUrl ? (
            <Image src={avatarUrl} alt="" fill sizes="40px" className="object-cover" unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-blue-300">
              {(suggestion.display_name || suggestion.username).charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white hover:text-blue-300">
            {suggestion.display_name || suggestion.username}
          </div>
          <div className="truncate text-xs text-gray-400">@{suggestion.username}</div>
        </div>
      </Link>
      <button
        type="button"
        onClick={handleFollow}
        disabled={loading}
        className={`min-h-[36px] rounded-full px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
          following
            ? 'border border-gray-600 text-gray-200 hover:border-red-500 hover:text-red-300'
            : 'bg-white text-black hover:bg-gray-200'
        }`}
      >
        {loading ? '...' : following ? 'Following' : 'Follow'}
      </button>
    </div>
  )
}
