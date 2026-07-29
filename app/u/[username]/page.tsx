// app/u/[username]/page.tsx
import { createClient } from '@/lib/backend-server'
import PostCard from '@/components/PostCard'
import ProfileActions from '@/components/ProfileActions'
import ProfileStats from '@/components/ProfileStats'
import SendMessageButton from '@/components/SendMessageButton'
import FriendButton from '@/components/FriendButton'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Settings, Ban } from 'lucide-react'
import { redirect } from 'next/navigation'
import Image from 'next/image'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: Promise<{
    username: string
  }>
}

export default async function ProfilePage(props: ProfilePageProps) {
  const params = await props.params;
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
      quoted_post:quoted_post_id(
        id,
        content,
        youtube_video_id,
        created_at,
        status,
        profiles:user_id(username, display_name, avatar_path),
        post_media(storage_path)
      ),
      likes(count),
      comments(count),
      reposts(count)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  const { data: repostRows } = await supabase
    .from('reposts')
    .select(`
      created_at,
      post:posts!reposts_post_id_fkey(
        *,
        profiles:user_id(username, display_name, avatar_path),
        post_media(storage_path),
        quoted_post:quoted_post_id(
          id,
          content,
          youtube_video_id,
          created_at,
          status,
          profiles:user_id(username, display_name, avatar_path),
          post_media(storage_path)
        ),
        likes(count),
        comments(count),
        reposts(count)
      )
    `)
    .eq('user_id', profile.id)
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
  let repostedPostIds: Set<string> = new Set()
  let currentUserRole: string | undefined
  if (currentUser) {
    const [{ data: userLikes }, { data: userReposts }, { data: curProfile }] = await Promise.all([
      supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', currentUser.id),
      supabase
        .from('reposts')
        .select('post_id')
        .eq('user_id', currentUser.id),
      supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single(),
    ])
    if (userLikes) likedPostIds = new Set(userLikes.map(l => l.post_id))
    if (userReposts) repostedPostIds = new Set(userReposts.map((r: any) => r.post_id))
    currentUserRole = curProfile?.role
  }

  const postsWithLikeStatus = posts?.map(post => ({
    ...post,
    feed_key: `post-${post.id}`,
    user_liked: likedPostIds.has(post.id),
    user_reposted: repostedPostIds.has(post.id),
  })) || []

  const repostedPosts = (repostRows || [])
    .map((r: any) => {
      const p = r.post
      if (!p || p.status !== 'active') return null
      return {
        ...p,
        feed_key: `repost-${profile.id}-${p.id}-${r.created_at}`,
        reposted_at: r.created_at,
        reposted_by_profile: {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          avatar_path: profile.avatar_path,
        },
        user_liked: likedPostIds.has(p.id),
        user_reposted: repostedPostIds.has(p.id),
      }
    })
    .filter(Boolean)

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
      {/* Profile Header with Cover */}
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        {/* Cover Photo Gradient */}
        <div className="h-32 sm:h-48 bg-gradient-to-r from-[#1A1A2E] via-[#16213E] to-[#E94560] relative">
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
        
        <div className="px-4 sm:px-6 md:px-8 pb-6 sm:pb-8 -mt-12 sm:-mt-16 relative">
          <div className="flex flex-col md:flex-row items-start md:items-end gap-4 sm:gap-6">
            {/* Avatar */}
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center border-4 border-white shadow-lg overflow-hidden flex-shrink-0 ring-2 ring-slate-100">
              {profile.avatar_path ? (
                <Image
                  src={`${process.env.NEXT_PUBLIC_S3_PUBLIC_URL}/post-images/${profile.avatar_path}`}
                  alt=""
                  width={128}
                  height={128}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl sm:text-4xl font-bold text-blue-600">
                  {profile.display_name?.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 break-words">{profile.display_name}</h1>
              <p className="text-slate-500 text-base sm:text-lg">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-2 text-slate-600 leading-relaxed max-w-md break-words text-sm sm:text-base">{profile.bio}</p>
              )}
              <ProfileStats
                profileId={profile.id}
                followersCount={followersCount || 0}
                followingCount={followingCount || 0}
                postsCount={posts?.length || 0}
              />
            </div>
            
            <div className="flex flex-row md:flex-col gap-2 items-center flex-wrap justify-center">
              {currentUser && currentUser.id === profile.id && (
                <Link
                  href="/settings"
                  className="flex items-center gap-2 border-2 border-slate-200 text-slate-700 px-6 sm:px-8 py-2.5 rounded-full font-bold hover:bg-slate-50 hover:border-slate-300 transition-all min-h-[44px] text-sm"
                >
                  <Settings size={16} />
                  Edit Profile
                </Link>
              )}
              {currentUser && currentUser.id !== profile.id && (
                <form action={toggleBlock} className="contents">
                  <button
                    className={`flex items-center gap-2 px-6 sm:px-8 py-2.5 rounded-full font-bold transition-all min-h-[44px] text-sm ${
                      hasBlocked
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'border-2 border-slate-200 text-slate-700 hover:border-red-200 hover:text-red-600 hover:bg-red-50'
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
                    initialFollowersCount={followersCount || 0}
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
            <div className="mt-4 bg-red-50 border border-red-100 rounded-2xl p-3 text-sm text-red-700">
              You can&apos;t interact with this user right now.
            </div>
          )}
          {hasBlocked && (
            <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-3 text-sm text-slate-600">
              You blocked this user. Unblock to follow, add friends or send messages.
            </div>
          )}
        </div>
      </div>

      {/* User Posts */}
      <div className="divide-y divide-slate-100 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-50">
          <h2 className="font-bold text-slate-900 text-lg sm:text-xl flex items-center gap-2">
            <span className="w-1 h-5 bg-blue-500 rounded-full" />
            Posts
          </h2>
        </div>
        {postsWithLikeStatus.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUser?.id} currentUserRole={currentUserRole} />
        ))}
        {postsWithLikeStatus.length === 0 && (
          <div className="p-10 sm:p-20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">This user hasn&apos;t posted anything yet.</p>
            <p className="text-slate-400 text-sm mt-1">Posts will appear here once they start sharing.</p>
          </div>
        )}
      </div>

      <div className="divide-y divide-slate-100 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-50">
          <h2 className="font-bold text-slate-900 text-lg sm:text-xl flex items-center gap-2">
            <span className="w-1 h-5 bg-emerald-500 rounded-full" />
            Reposts
          </h2>
        </div>
        {repostedPosts.map((post: any) => (
          <PostCard key={post.feed_key || post.id} post={post} currentUserId={currentUser?.id} currentUserRole={currentUserRole} />
        ))}
        {repostedPosts.length === 0 && (
          <div className="p-10 sm:p-20 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium">No reposts yet.</p>
            <p className="text-slate-400 text-sm mt-1">Reposted content will appear here.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export async function generateMetadata(props: ProfilePageProps): Promise<Metadata> {
  const params = await props.params;
  const supabase = createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_path')
    .eq('username', params.username.toLowerCase())
    .maybeSingle()

  const title = profile?.display_name ? `${profile.display_name} (@${profile.username})` : `@${params.username}`
  const description = profile?.bio || `View @${params.username} on Mini Social.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}
