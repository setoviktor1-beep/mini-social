// app/page.tsx
import { createClient } from '@/lib/server-supabase'
import PostComposer from '@/components/PostComposer'
import PostCard from '@/components/PostCard'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: posts } = await supabase
    .from('posts')
    .select(`
      *,
      profiles:user_id(username, display_name, avatar_path),
      post_media(storage_path),
      likes(count)
    `)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="space-y-6">
      {user ? (
        <PostComposer userId={user.id} />
      ) : (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl text-blue-700 text-center">
          <p>Sign in to join the conversation.</p>
        </div>
      )}

      <div className="divide-y divide-gray-100 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {posts?.map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={user?.id} />
        ))}
        {(!posts || posts.length === 0) && (
          <div className="p-10 text-center text-gray-500">
            No posts yet. Start the trend!
          </div>
        )}
      </div>
    </div>
  )
}
