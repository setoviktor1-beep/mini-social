'use client'

import { useEffect, useState } from 'react'

interface ProfileStatsProps {
  profileId: string
  followersCount: number
  followingCount: number
  postsCount: number
}

function pluralizeFollowers(count: number) {
  return count === 1 ? 'follower' : 'followers'
}

export default function ProfileStats({
  profileId,
  followersCount,
  followingCount,
  postsCount,
}: ProfileStatsProps) {
  const [localFollowersCount, setLocalFollowersCount] = useState(followersCount)

  useEffect(() => {
    setLocalFollowersCount(followersCount)
  }, [followersCount])

  useEffect(() => {
    const handleFollowerCount = (event: Event) => {
      const customEvent = event as CustomEvent<{ profileId: string; followersCount: number }>
      if (customEvent.detail?.profileId !== profileId) return
      setLocalFollowersCount(Math.max(0, customEvent.detail.followersCount))
    }

    window.addEventListener('profile-follow-count', handleFollowerCount as EventListener)
    return () => window.removeEventListener('profile-follow-count', handleFollowerCount as EventListener)
  }, [profileId])

  return (
    <div className="flex gap-4 sm:gap-6 mt-3 justify-center md:justify-start flex-wrap">
      <span className="text-sm">
        <strong className="text-gray-900 dark:text-gray-100">{localFollowersCount}</strong>{' '}
        <span className="text-gray-500 dark:text-gray-400">{pluralizeFollowers(localFollowersCount)}</span>
      </span>
      <span className="text-sm">
        <strong className="text-gray-900 dark:text-gray-100">{followingCount}</strong>{' '}
        <span className="text-gray-500 dark:text-gray-400">following</span>
      </span>
      <span className="text-sm">
        <strong className="text-gray-900 dark:text-gray-100">{postsCount}</strong>{' '}
        <span className="text-gray-500 dark:text-gray-400">posts</span>
      </span>
    </div>
  )
}
