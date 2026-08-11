'use client'
import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'
import { Clock } from 'lucide-react'

interface ProfileActionsProps {
  profileId: string
  currentUserId?: string
  isFollowing: boolean
  initialFollowersCount: number
  isPrivate?: boolean
  // 'none' | 'pending' | 'rejected' — irrelevant once isFollowing is true
  // (an accepted request already materialized into a follows row).
  initialRequestStatus?: 'none' | 'pending' | 'rejected'
}

export default function ProfileActions({
  profileId,
  currentUserId,
  isFollowing: initialFollowing,
  initialFollowersCount,
  isPrivate = false,
  initialRequestStatus = 'none',
}: ProfileActionsProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [followersCount, setFollowersCount] = useState(initialFollowersCount)
  const [requestStatus, setRequestStatus] = useState(initialRequestStatus)
  const [loading, setLoading] = useState(false)
  const isOwner = currentUserId === profileId

  useEffect(() => {
    setFollowing(initialFollowing)
  }, [initialFollowing])

  useEffect(() => {
    setFollowersCount(initialFollowersCount)
  }, [initialFollowersCount])

  useEffect(() => {
    setRequestStatus(initialRequestStatus)
  }, [initialRequestStatus])

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

  const handleUnfollow = async () => {
    if (!currentUserId || loading) return
    setLoading(true)
    const { error } = await supabase.from('follows').delete()
      .eq('follower_id', currentUserId)
      .eq('following_id', profileId)
    if (!error) {
      setFollowing(false)
      setRequestStatus('none')
      syncFollowersCount(Math.max(0, followersCount - 1))
    }
    setLoading(false)
    router.refresh()
  }

  const handleFollowPublic = async () => {
    if (!currentUserId || loading) return
    setLoading(true)
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
    setLoading(false)
    router.refresh()
  }

  // Private target: server-enforced via db/migrations/0013_private_accounts.sql
  // (a direct `follows` insert for a private target is rejected by the
  // enforce_follow_request trigger regardless of what this button does) —
  // this sends a follow_requests row instead, and the UI reflects
  // "Requested" until the target accepts.
  const handleRequestFollow = async () => {
    if (!currentUserId || loading) return
    setLoading(true)
    const { error } = await supabase.from('follow_requests').upsert({
      requester_id: currentUserId,
      target_id: profileId,
      status: 'pending',
    }, {
      onConflict: 'requester_id,target_id',
    })
    if (!error) {
      setRequestStatus('pending')
      await supabase.from('notifications').insert({
        user_id: profileId,
        actor_id: currentUserId,
        type: 'follow_request',
        target_id: currentUserId,
        target_type: 'user',
      })
    }
    setLoading(false)
  }

  const handleCancelRequest = async () => {
    if (!currentUserId || loading) return
    setLoading(true)
    const { error } = await supabase.from('follow_requests').delete()
      .eq('requester_id', currentUserId)
      .eq('target_id', profileId)
    if (!error) setRequestStatus('none')
    setLoading(false)
  }

  if (!currentUserId || isOwner) return null

  if (following) {
    return (
      <div className="flex gap-2 sm:gap-3">
        <button
          onClick={handleUnfollow}
          disabled={loading}
          className="px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all shadow-sm min-h-[44px] text-sm border-2 border-slate-300 dark:border-gray-600 text-slate-700 dark:text-gray-300 hover:border-red-300 dark:hover:border-red-800 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
        >
          {loading ? '...' : 'Nebesekti'}
        </button>
      </div>
    )
  }

  if (isPrivate && requestStatus === 'pending') {
    return (
      <div className="flex gap-2 sm:gap-3">
        <button
          onClick={handleCancelRequest}
          disabled={loading}
          aria-label="Atšaukti sekimo užklausą"
          className="flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all shadow-sm min-h-[44px] text-sm bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400"
        >
          <Clock size={16} />
          {loading ? '...' : 'Užklausa išsiųsta'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2 sm:gap-3">
      <button
        onClick={isPrivate ? handleRequestFollow : handleFollowPublic}
        disabled={loading}
        className="px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all shadow-sm min-h-[44px] text-sm bg-[#1A1A2E] text-white hover:bg-[#16213E] hover:shadow-md"
      >
        {loading ? '...' : isPrivate ? 'Prašyti sekti' : 'Sekti'}
      </button>
    </div>
  )
}
