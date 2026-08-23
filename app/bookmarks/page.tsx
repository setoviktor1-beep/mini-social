// app/bookmarks/page.tsx
import { createClient } from '@/lib/backend-server'
import { redirect } from 'next/navigation'
import { attachUserInteractionFlags } from '@/lib/feed-service'
import BookmarksClient from '@/components/BookmarksClient'

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
        post_media(storage_path,media_type),
        quoted_post:quoted_post_id(
          id,
          content,
          youtube_video_id,
          created_at,
          status,
          profiles:user_id(username, display_name, avatar_path),
          post_media(storage_path,media_type)
        ),
        reactions(count),
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

  const rawPosts = (bookmarkRows || [])
    .map((row: any) => row.post)
    .filter((post: any) => post && post.status === 'active')
    .map((post: any) => ({
      ...post,
      feed_key: `bookmark-${post.id}`,
    }))

  const posts = (await attachUserInteractionFlags(supabase, user.id, rawPosts))
    .map((post: any) => ({ ...post, user_bookmarked: true }))

  return <BookmarksClient posts={posts} userId={user.id} userRole={profile?.role} />
}
