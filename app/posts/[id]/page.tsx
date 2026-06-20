import { notFound } from 'next/navigation'
import { createClient } from '@/lib/server-supabase'
import { attachUserInteractionFlags } from '@/lib/feed-service'
import PostCard from '@/components/PostCard'

export const dynamic = 'force-dynamic'

const POST_SELECT = `
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
`

export default async function PostPermalinkPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const [{ data: authData }, { data: post }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('posts').select(POST_SELECT).eq('id', params.id).eq('status', 'active').single(),
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return { data: null }
      return supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()
    }),
  ])

  if (!post) {
    notFound()
  }

  const [postWithFlags] = await attachUserInteractionFlags(
    supabase,
    authData.user?.id,
    [post],
  )

  return (
    <div className="mx-auto max-w-3xl">
      <div className="overflow-hidden rounded-2xl border border-gray-800/60 bg-gray-900/40">
        <PostCard
          post={postWithFlags}
          currentUserId={authData.user?.id}
          currentUserRole={profile?.role}
        />
      </div>
    </div>
  )
}
