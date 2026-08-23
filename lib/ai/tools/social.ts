export async function getMyPosts(userId: string, supabase: any, limit = 10) {
  const safeLimit = Math.min(Math.max(1, limit), 20)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, content, created_at, likes_count, comments_count')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error || !posts) {
    return { posts: [] }
  }

  return {
    count: posts.length,
    posts: posts.map((p: any) => ({
      id: p.id,
      content: p.content,
      createdAt: p.created_at,
      likes: p.likes_count ?? 0,
      comments: p.comments_count ?? 0,
    })),
  }
}

export async function getMyBookmarks(userId: string, supabase: any, limit = 10) {
  const safeLimit = Math.min(Math.max(1, limit), 20)
  const { data: bookmarks, error } = await supabase
    .from('bookmarks')
    .select('created_at, post:posts(id, content, created_at, author:profiles!posts_user_id_fkey(username, display_name))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error || !bookmarks) {
    return { bookmarks: [] }
  }

  return {
    count: bookmarks.length,
    bookmarks: bookmarks
      .filter((b: any) => Boolean(b.post))
      .map((b: any) => ({
        bookmarkedAt: b.created_at,
        postId: b.post.id,
        content: b.post.content,
        author: b.post.author?.display_name || b.post.author?.username || 'Autorius',
      })),
  }
}

export async function getMyNotifications(userId: string, supabase: any, limit = 10) {
  const safeLimit = Math.min(Math.max(1, limit), 20)
  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, type, message, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error || !notifications) {
    return { notifications: [] }
  }

  return {
    unreadCount: notifications.filter((n: any) => !n.is_read).length,
    notifications: notifications.map((n: any) => ({
      id: n.id,
      type: n.type,
      message: n.message,
      isRead: n.is_read,
      createdAt: n.created_at,
    })),
  }
}
