export type TabKey = 'for_you' | 'following' | 'latest'

type FeedMode = 'top' | 'paged'

type FeedQueryOptions = {
  supabase: any
  user: { id: string } | null
  tab: TabKey
  page?: number
  pageSize?: number
  mode?: FeedMode
}

const BASE_SELECT = `
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

const REPOST_SELECT = `
  created_at,
  reposter:profiles!reposts_user_id_fkey(id, username, display_name, avatar_path),
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
`

export function parseTab(tab: string | null | undefined): TabKey {
  if (tab === 'for_you' || tab === 'following' || tab === 'latest') return tab
  return 'latest'
}

export function parsePage(page: string | null | undefined) {
  const n = Number(page)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

export function sortByTimeDesc(a: any, b: any) {
  const at = new Date(a.feed_sort_at || a.created_at).getTime()
  const bt = new Date(b.feed_sort_at || b.created_at).getTime()
  return bt - at
}

function logFeedError(context: string, error: unknown) {
  console.error(`[feed-service] ${context}`, error)
}

async function safeQuery<T>(context: string, query: Promise<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  try {
    const { data, error } = await query
    if (error) {
      logFeedError(context, error)
      return fallback
    }
    return data ?? fallback
  } catch (error) {
    logFeedError(context, error)
    return fallback
  }
}

export async function getBlockedUserIds(supabase: any, userId?: string) {
  if (!userId) return [] as string[]

  const [blocksByMe, blocksMe] = await Promise.all([
    safeQuery<any[]>('getBlockedUserIds:blocksByMe', supabase.from('blocks').select('blocked_id').eq('blocker_id', userId), []),
    safeQuery<any[]>('getBlockedUserIds:blocksMe', supabase.from('blocks').select('blocker_id').eq('blocked_id', userId), []),
  ])

  const ids = [
    ...blocksByMe.map((r: any) => r.blocked_id),
    ...blocksMe.map((r: any) => r.blocker_id),
  ].filter(Boolean)

  return Array.from(new Set(ids))
}

function applyBlockedFilter(query: any, blockedUserIds: string[]) {
  if (blockedUserIds.length === 0) return query
  const inList = blockedUserIds.map((id) => `"${id}"`).join(',')
  return query.not('user_id', 'in', `(${inList})`)
}

async function getFollowedIds(supabase: any, userId?: string) {
  if (!userId) return [] as string[]
  const rows = await safeQuery<any[]>(
    'getFollowedIds',
    supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId),
    []
  )
  return rows.map((r: any) => r.following_id).filter(Boolean)
}

function rankForYou(rows: any[]) {
  rows.sort((a: any, b: any) => {
    const ap = (a.likes?.[0]?.count || 0) + (a.comments?.[0]?.count || 0)
    const bp = (b.likes?.[0]?.count || 0) + (b.comments?.[0]?.count || 0)
    if (bp !== ap) return bp - ap
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
  return rows
}

export async function getFeedItems(options: FeedQueryOptions) {
  try {
    const {
      supabase,
      user,
      tab,
      page = 0,
      pageSize = 20,
      mode = 'top',
    } = options
    const postPoolSize = mode === 'paged' ? (page + 1) * pageSize * 3 : pageSize
    const repostPoolSize = mode === 'paged' ? (page + 1) * pageSize * 3 : pageSize * 2

    const blockedUserIds = await getBlockedUserIds(supabase, user?.id)
    const blockedSet = new Set(blockedUserIds)
    const followedIds = tab === 'following' ? await getFollowedIds(supabase, user?.id) : []

    let posts: any[] = []
    let repostItems: any[] = []

    if (tab === 'following' && user) {
      if (followedIds.length > 0) {
        let q = supabase
          .from('posts')
          .select(BASE_SELECT)
          .eq('status', 'active')
          .in('user_id', followedIds)
        q = applyBlockedFilter(q, blockedUserIds)
        posts = await safeQuery<any[]>(
          'getFeedItems:followingPosts',
          q.order('created_at', { ascending: false }).limit(postPoolSize),
          []
        )
      }
    } else if (tab === 'for_you' && user) {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      let q = supabase
        .from('posts')
        .select(BASE_SELECT)
        .eq('status', 'active')
        .gte('created_at', since)
      q = applyBlockedFilter(q, blockedUserIds)
      const data = await safeQuery<any[]>(
        'getFeedItems:forYouPosts',
        q.order('created_at', { ascending: false }).limit(200),
        []
      )
      const ranked = rankForYou(data)
      if (mode === 'paged') {
        const from = page * pageSize
        posts = ranked.slice(from, from + pageSize)
      } else {
        posts = ranked.slice(0, pageSize)
      }
    } else {
      let q = supabase.from('posts').select(BASE_SELECT).eq('status', 'active')
      q = applyBlockedFilter(q, blockedUserIds)
      posts = await safeQuery<any[]>(
        'getFeedItems:latestPosts',
        q.order('created_at', { ascending: false }).limit(postPoolSize),
        []
      )
    }

    if (tab !== 'for_you') {
      let repostQuery = supabase
        .from('reposts')
        .select(REPOST_SELECT)
        .order('created_at', { ascending: false })
        .limit(repostPoolSize)

      if (tab === 'following' && user) {
        if (followedIds.length > 0) {
          repostQuery = repostQuery.in('user_id', followedIds)
        } else {
          repostItems = []
        }
      }

      if (!(tab === 'following' && user && followedIds.length === 0)) {
        const repostRows = await safeQuery<any[]>(
          'getFeedItems:reposts',
          repostQuery,
          []
        )
        repostItems = repostRows
          .map((r: any) => {
            const p = r.post
            if (!p || p.status !== 'active') return null
            return {
              ...p,
              feed_key: `repost-${r.reposter?.id || 'u'}-${p.id}-${r.created_at}`,
              reposted_at: r.created_at,
              reposted_by_profile: r.reposter || null,
              feed_sort_at: r.created_at,
            }
          })
          .filter(Boolean)
          .filter((p: any) => {
            if (!user || blockedSet.size === 0) return true
            const postAuthor = p.user_id
            const reposterId = p.reposted_by_profile?.id
            return !blockedSet.has(postAuthor) && !blockedSet.has(reposterId)
          })
      }
    }

    const baseItems = posts.map((post: any) => ({
      ...post,
      feed_key: `post-${post.id}`,
      feed_sort_at: post.created_at,
    }))

    const merged = tab === 'for_you'
      ? baseItems
      : [...baseItems, ...repostItems].sort(sortByTimeDesc)
    const pageSlice = mode === 'paged'
      ? merged.slice(page * pageSize, (page + 1) * pageSize)
      : merged.slice(0, pageSize)

    return {
      posts: pageSlice,
      blockedUserIds,
    }
  } catch (error) {
    logFeedError('getFeedItems:unhandled', error)
    return {
      posts: [],
      blockedUserIds: [],
    }
  }
}

export async function attachUserInteractionFlags(
  supabase: any,
  userId: string | undefined,
  posts: any[]
) {
  if (!userId || posts.length === 0) {
    return posts.map((post) => ({
      ...post,
      user_liked: false,
      user_reposted: false,
    }))
  }

  try {
    const candidateIds = Array.from(new Set(posts.map((p: any) => p.id).filter(Boolean)))
    const [likes, reposts] = await Promise.all([
      safeQuery<any[]>(
        'attachUserInteractionFlags:likes',
        supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', candidateIds),
        []
      ),
      safeQuery<any[]>(
        'attachUserInteractionFlags:reposts',
        supabase.from('reposts').select('post_id').eq('user_id', userId).in('post_id', candidateIds),
        []
      ),
    ])

    const likedPostIds = new Set((likes || []).map((l: any) => l.post_id))
    const repostedPostIds = new Set((reposts || []).map((r: any) => r.post_id))

    return posts.map((post: any) => ({
      ...post,
      user_liked: likedPostIds.has(post.id),
      user_reposted: repostedPostIds.has(post.id),
    }))
  } catch (error) {
    logFeedError('attachUserInteractionFlags:unhandled', error)
    return posts.map((post: any) => ({
      ...post,
      user_liked: false,
      user_reposted: false,
    }))
  }
}
