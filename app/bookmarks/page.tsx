// app/bookmarks/page.tsx
import { createClient } from '@/lib/backend-server'
import PostCard from '@/components/PostCard'
import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function BookmarksPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/bookmarks')
  }

  const { data: bookmarkRows } = await supabase
    .from('bookmarks')
    .select(`
      created_at,
      post:posts!bookmarks_post_id_fkey(
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
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const posts = (bookmarkRows || [])
    .map((row: any) => row.post)
    .filter((post: any) => post && post.status === 'active')
    .map((post: any) => ({
      ...post,
      feed_key: `bookmark-${post.id}`,
      user_liked: false,
      user_reposted: false,
      user_bookmarked: true,
    }))

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="divide-y divide-slate-100 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-50">
          <h1 className="font-bold text-slate-900 text-lg sm:text-xl flex items-center gap-2">
            <Bookmark size={18} className="text-amber-500" />
            Išsaugoti įrašai
          </h1>
        </div>

        {posts.map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={user.id} currentUserRole={profile?.role} />
        ))}

        {posts.length === 0 && (
          <div className="p-10 sm:p-16 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <Bookmark size={28} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">Dar neturite išsaugotų įrašų.</p>
            <p className="text-slate-400 text-sm mt-1">Paspauskite žymeklio ikoną prie įrašo, kad jį išsaugotumėte.</p>
          </div>
        )}
      </div>
    </div>
  )
}
