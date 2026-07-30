'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'

interface ProfileActionsProps {
  profileId: string
  currentUserId?: string
  isFollowing: boolean
  initialFollowersCount: number
}

export default function ProfileActions({
  profileId,
  currentUserId,
  isFollowing: initialFollowing,
  initialFollowersCount,
}: ProfileActionsProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [loading, setLoading] = useState(false)
  const isOwner = currentUserId === profileId

  useEffect(() => {
    setFollowing(initialFollowing)
  }, [initialFollowing])

  useEffect(() => {
    setFollowersCount(initialFollowersCount)
  }, [initialFollowersCount])

  const syncFollowersCount = (nextCount: number) => {
    setFollowersCount(nextCount)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('profile-follow-count', {
        detail: {
          profileId,
          followersCount: nextCount,
        },
      }))
    }
  }

  const handleFollow = async () => {
    if (!currentUserId || loading) return
    setLoading(true)

    if (following) {
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', profileId)
      if (!error) {
        setFollowing(false)
        syncFollowersCount(Math.max(0, followersCount - 1))
      }
    } else {
      const { error } = await supabase.from('follows').upsert({
        follower_id: currentUserId,
        following_id: profileId
      }, {
        onConflict: 'follower_id,following_id',
        ignoreDuplicates: true,
      })
      if (!error) {
        setFollowing(true)
        syncFollowersCount(followersCount + 1)
        await supabase.from('notifications').insert({
          user_id: profileId,
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

  if (!currentUserId || isOwner) return null

  return (
    <div className="flex gap-2 sm:gap-3">
      <button
        onClick={handleFollow}
        disabled={loading}
        className={`px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all shadow-sm min-h-[44px] text-sm ${
          following
            ? 'border-2 border-slate-300 text-slate-700 hover:border-red-300 hover:text-red-600 hover:bg-red-50'
            : 'bg-[#1A1A2E] text-white hover:bg-[#16213E] hover:shadow-md'
        }`}
      >
        {loading ? '...' : following ? 'Nebesekti' : 'Sekti'}
      </button>
    </div>
  )
}
