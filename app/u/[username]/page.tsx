// app/u/[username]/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostCard from '@/components/PostCard'
import ProfileActions from '@/components/ProfileActions'
import SendMessageButton from '@/components/SendMessageButton'
import FriendButton from '@/components/FriendButton'
import { notFound } from 'next/navigation'

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

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
            {profile.avatar_path ? (
              <img
                src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-images/${profile.avatar_path}`}
                className="w-full h-full object-cover"
                alt=""
              />
            ) : (
              <span className="text-3xl font-bold text-blue-200">
                {profile.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="text-center md:text-left flex-1">
            <h1 className="text-3xl font-black text-gray-900">{profile.display_name}</h1>
            <p className="text-gray-500 text-lg">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-3 text-gray-700 leading-relaxed max-w-md">{profile.bio}</p>
            )}
            <div className="flex gap-6 mt-3 justify-center md:justify-start">
              <span className="text-sm">
                <strong className="text-gray-900">{followersCount || 0}</strong>{' '}
                <span className="text-gray-500">followers</span>
              </span>
              <span className="text-sm">
                <strong className="text-gray-900">{followingCount || 0}</strong>{' '}
                <span className="text-gray-500">following</span>
              </span>
              <span className="text-sm">
                <strong className="text-gray-900">{posts?.length || 0}</strong>{' '}
                <span className="text-gray-500">posts</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-center">
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
          </div>
        </div>
      </div>

      {/* User Posts */}
      <div className="divide-y divide-gray-100 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-50">
          <h2 className="font-bold text-gray-900 text-xl">Posts</h2>
        </div>
        {postsWithLikeStatus.map((post) => (
          <PostCard key={post.id} post={post} currentUserId={currentUser?.id} currentUserRole={currentUserRole} />
        ))}
        {postsWithLikeStatus.length === 0 && (
          <div className="p-20 text-center text-gray-400">
            This user hasn&apos;t posted anything yet.
          </div>
        )}
      </div>
    </div>
  )
}
