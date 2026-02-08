// app/u/[username]/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostCard from '@/components/PostCard'
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
      likes(count)
    `)
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-8">
      {/* Profile Header */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center border-4 border-white shadow-sm overflow-hidden">
            {profile.avatar_path ? (
              <img 
                src={supabase.storage.from('post-images').getPublicUrl(profile.avatar_path).data.publicUrl} 
                className="w-full h-full object-cover"
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
          </div>
          <div className="flex gap-3">
            {currentUser?.id !== profile.id && (
              <button className="bg-blue-600 text-white px-8 py-2.5 rounded-full font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-100">
                Follow
              </button>
            )}
            {currentUser?.id === profile.id && (
              <button className="border-2 border-gray-200 text-gray-700 px-8 py-2.5 rounded-full font-bold hover:bg-gray-50 transition-all">
                Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* User Posts */}
      <div className="divide-y divide-gray-100 bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-50">
          <h2 className="font-bold text-gray-900 text-xl">Posts</h2>
        </div>
        {posts?.map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={currentUser?.id} />
        ))}
        {(!posts || posts.length === 0) && (
          <div className="p-20 text-center text-gray-400">
            This user hasn't posted anything yet.
          </div>
        )}
      </div>
    </div>
  )
}
