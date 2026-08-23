export async function getMyPosts(userId: string, supabase: any, limit = 10) {
  const safeLimit = Math.min(Math.max(1, limit), 20)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, content, created_at')
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

/**
 * Prepares a proposed post draft for user confirmation.
 */
export async function prepareCreatePost(
  userId: string,
  content: string,
) {
  const cleanContent = (content || '').trim().slice(0, 2000)
  if (!cleanContent) {
    return { error: 'Įrašo tekstas negali būti tuščias' }
  }

  return {
    action: 'create_post',
    status: 'draft',
    requiresConfirmation: true,
    draft: {
      content: cleanContent,
    },
    message: `Paruoštas įrašo juodraštis: "${cleanContent}". Reikalingas vartotojo patvirtinimas prieš paskelbiant.`,
  }
}

/**
 * Creates and publishes a social post strictly on behalf of authenticated user.
 */
export async function createPost(
  userId: string,
  supabase: any,
  content: string,
) {
  const cleanContent = (content || '').trim()
  if (!cleanContent) {
    return { error: 'Įrašo tekstas negali būti tuščias' }
  }
  if (cleanContent.length > 2000) {
    return { error: 'Įrašo tekstas viršija leistiną 2000 simbolių limitą' }
  }

  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content: cleanContent,
      status: 'active',
    })
    .select('id, content, created_at')
    .single()

  if (error || !post) {
    return { error: `Nepavyko paskelbti įrašo: ${error?.message || 'DB klaida'}` }
  }

  return {
    success: true,
    message: 'Įrašas sėkmingai paskelbtas į MiniSocial!',
    post: {
      id: post.id,
      content: post.content,
      createdAt: post.created_at,
    },
  }
}

/**
 * Reads latest public feed posts (public social activity).
 */
export async function getPublicFeed(
  supabase: any,
  limit = 10,
) {
  const safeLimit = Math.min(Math.max(1, limit), 20)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, content, created_at, author:profiles!posts_user_id_fkey(username, display_name)')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error || !posts) {
    return { feed: [] }
  }

  return {
    count: posts.length,
    feed: posts.map((p: any) => ({
      id: p.id,
      content: p.content,
      createdAt: p.created_at,
      author: p.author?.display_name || p.author?.username || 'Vartotojas',
      username: p.author?.username || 'user',
    })),
  }
}
