// app/u/[username]/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostCard from '@/components/PostCard'
import ProfileActions from '@/components/ProfileActions'
import SendMessageButton from '@/components/SendMessageButton'
import FriendButton from '@/components/FriendButton'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Settings, Ban } from 'lucide-react'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: {
    username: string
  }
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const supabase = createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()

  // 1. Fetch Profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username.toLowerCase())
    .single()

  if (profileError || !profile) {
    notFound()
  }

  // 2. Fetch User's Posts
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id(username, display_name, avatar_path),
      post_media(storage_path),
      likes(count),
      comments(count)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  // 3. Check follow status and counts
  let isFollowing = false
  if (currentUser && currentUser.id !== profile.id) {
    const { data: followData } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profile.id)
      .maybeSingle()
    isFollowing = !!followData
  }

  // 3b. Check block status (both directions)
  let hasBlocked = false
  let blockedBy = false
  if (currentUser && currentUser.id !== profile.id) {
    const [{ data: blockRow }, { data: blockedByRow }] = await Promise.all([
      supabase
        .from('blocks')
        .select('id')
        .eq('blocker_id', currentUser.id)
        .eq('blocked_id', profile.id)
        .maybeSingle(),
      supabase
        .from('blocks')
        .select('id')
        .eq('blocker_id', profile.id)
        .eq('blocked_id', currentUser.id)
        .maybeSingle(),
    ])
    hasBlocked = !!blockRow
    blockedBy = !!blockedByRow
  }

  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profile.id)

  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profile.id)

  // 4. Check liked posts and user role
  let likedPostIds: Set<string> = new Set()
  let currentUserRole: string | undefined
  if (currentUser) {
    const { data: userLikes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', currentUser.id)
    if (userLikes) {
      likedPostIds = new Set(userLikes.map(l => l.post_id))
    }
    const { data: curProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .single()
    currentUserRole = curProfile?.role
  }

  const postsWithLikeStatus = posts?.map(post => ({
    ...post,
    user_liked: likedPostIds.has(post.id)
  })) || []

  const isBlockedEitherWay = hasBlocked || blockedBy

  const toggleBlock = async () => {
    'use server'
    const s = createClient()
    const { data: { user } } = await s.auth.getUser()
    if (!user || user.id === profile.id) return

    const { data: existing } = await s
      .from('blocks')
      .select('id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', profile.id)
      .maybeSingle()

    if (existing) {
      await s.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', profile.id)
    } else {
      await s.from('blocks').insert({ blocker_id: user.id, blocked_id: profile.id })
    }

    redirect(`/u/${profile.username}`)
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Profile Header */}
      <div className="bg-white dark:bg-gray-900 p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800">
        <div className="flex flex-col md:flex-row items-center gap-4 sm:gap-6">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-sm overflow-hidden flex-shrink-0">
            {profile.avatar_path ? (
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${profile.avatar_path}`}
                className="w-full h-full object-cover"
                alt=""
              />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold text-blue-200 dark:text-blue-500">
                {profile.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-center md:text-left flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 break-words">{profile.display_name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-base sm:text-lg">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-2 sm:mt-3 text-gray-700 dark:text-gray-300 leading-relaxed max-w-md break-words">{profile.bio}</p>
            )}
            <div className="flex gap-4 sm:gap-6 mt-3 justify-center md:justify-start flex-wrap">
              <span className="text-sm">
                <strong className="text-gray-900 dark:text-gray-100">{followersCount || 0}</strong>{' '}
                <span className="text-gray-500 dark:text-gray-400">followers</span>
              </span>
              <span className="text-sm">
                <strong className="text-gray-900 dark:text-gray-100">{followingCount || 0}</strong>{' '}
                <span className="text-gray-500 dark:text-gray-400">following</span>
              </span>
              <span className="text-sm">
                <strong className="text-gray-900 dark:text-gray-100">{posts?.length || 0}</strong>{' '}
                <span className="text-gray-500 dark:text-gray-400">posts</span>
              </span>
            </div>
          </div>
          <div className="flex flex-row md:flex-col gap-2 items-center flex-wrap justify-center">
            {currentUser && currentUser.id === profile.id && (
              <Link
                href="/settings"
                className="flex items-center gap-2 border-2 border-blue-200 dark:border-blue-700 text-blue-600 px-6 sm:px-8 py-2.5 rounded-full font-bold hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all min-h-[44px]"
              >
                <Settings size={16} />
                Edit Profile
              </Link>
            )}
            {currentUser && currentUser.id !== profile.id && (
              <form action={toggleBlock} className="contents">
                <button
                  className={`flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all min-h-[44px] ${
                    hasBlocked
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      : 'border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-red-200 dark:hover:border-red-700 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
                  }`}
                  title={hasBlocked ? 'Unblock user' : 'Block user'}
                >
                  <Ban size={16} />
                  {hasBlocked ? 'Unblock' : 'Block'}
                </button>
              </form>
            )}

            {!isBlockedEitherWay && (
              <>
                <ProfileActions
                  profileId={profile.id}
                  currentUserId={currentUser?.id}
                  isFollowing={isFollowing}
                  profile={profile}
                />
                <FriendButton profileId={profile.id} currentUserId={currentUser?.id} />
                {currentUser && currentUser.id !== profile.id && (
                  <SendMessageButton otherUserId={profile.id} />
                )}
              </>
            )}
          </div>
        </div>
        {blockedBy && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-2xl p-3 text-sm text-red-700 dark:text-red-300">
            You can&apos;t interact with this user right now.
          </div>
        )}
        {hasBlocked && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl p-3 text-sm text-gray-600 dark:text-gray-300">
            You blocked this user. Unblock to follow, add friends or send messages.
          </div>
        )}
      </div>

      {/* User Posts */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-sm dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-50 dark:border-gray-800">
          <h2 className="font-bold text-gray-900 dark:text-gray-100 text-lg sm:text-xl">Posts</h2>
        </div>
        {postsWithLikeStatus.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUser?.id} currentUserRole={currentUserRole} />
        ))}
        {postsWithLikeStatus.length === 0 && (
          <div className="p-10 sm:p-20 text-center text-gray-400">
            This user hasn&apos;t posted anything yet.
          </div>
        )}
      </div>
    </div>
  )
}
