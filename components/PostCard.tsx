'use client'
import { createClient } from '@/lib/backend-client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, MessageCircle, AlertCircle, Send, X, Share2, Trash2, Check, Link as LinkIcon, Repeat2, Pencil, Bookmark, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import ImageLightbox from './ImageLightbox'
import ParsedContent from '@/lib/parseContent'
import { notifyMentions } from '@/lib/mentions'
import { sendPushNotification } from '@/lib/pushNotify'
import { extractYoutubeId, getYoutubeEmbedUrl, isOnlyYoutubeUrl, resolveSupabaseStorageUrl } from '@/lib/media'

export type ReactionType = 'like' | 'love' | 'laugh' | 'wow' | 'sad' | 'angry'

const REACTIONS: Record<ReactionType, { emoji: string; label: string }> = {
  like: { emoji: '👍', label: 'Patinka' },
  love: { emoji: '❤️', label: 'Super' },
  laugh: { emoji: '😂', label: 'Juokinga' },
  wow: { emoji: '😮', label: 'Įspūdinga' },
  sad: { emoji: '😢', label: 'Liūdna' },
  angry: { emoji: '😠', label: 'Piktina' },
}

function PostMediaImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-xs text-slate-400 rounded-lg">
        Image unavailable
      </div>
    )
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="block h-full w-full bg-slate-100 object-cover transition-transform duration-300 hover:scale-105 rounded-lg"
      onError={() => setFailed(true)}
      onLoad={(event) => {
        const element = event.currentTarget
        if (element.naturalWidth < 32 || element.naturalHeight < 32) {
          setFailed(true)
        }
      }}
    />
  )
}

interface PostCardProps {
  post: {
    id: string
    feed_key?: string
    content: string
    created_at: string
    user_id?: string
    youtube_url?: string | null
    youtube_video_id?: string
    edited_at?: string | null
    reposted_at?: string
    reposted_by_profile?: { id?: string; username: string; display_name: string; avatar_path?: string | null }
    profiles?: { username: string; display_name: string; avatar_path?: string }
    post_media?: { storage_path: string; media_type?: 'image' | 'video' }[]
    quoted_post?: {
      id: string
      content: string
      youtube_video_id?: string
      status?: string
      profiles?: { username: string; display_name: string; avatar_path?: string }
      post_media?: { storage_path: string; media_type?: 'image' | 'video' }[]
    } | null
    reactions?: { count: number }[]
    comments?: { count: number }[]
    reposts?: { count: number }[]
    user_liked?: boolean
    user_reaction?: ReactionType | null
    user_reposted?: boolean
    user_bookmarked?: boolean
  }
  currentUserId?: string
  currentUserRole?: string
}

export default function PostCard({ post, currentUserId, currentUserRole }: PostCardProps) {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const [userReaction, setUserReaction] = useState<ReactionType | null>(post.user_reaction ?? (post.user_liked ? 'like' : null))
  const [reactionCount, setReactionCount] = useState(Number(post.reactions?.[0]?.count || 0))
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([]) // top-level (parent_comment_id IS NULL) only
  const [replies, setReplies] = useState<any[]>([]) // all replies (depth 1 and 2) for this post
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count || 0)
  const [commentsHasMore, setCommentsHasMore] = useState(false)
  const [loadingMoreComments, setLoadingMoreComments] = useState(false)
  const [commentsError, setCommentsError] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [editingCommentLoading, setEditingCommentLoading] = useState(false)
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null)
  const [reportingCommentId, setReportingCommentId] = useState<string | null>(null)
  const [commentReportReason, setCommentReportReason] = useState('')
  const [commentReportSentId, setCommentReportSentId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null)
  const commentInputRef = useRef<HTMLInputElement | null>(null)
  const COMMENT_PAGE_SIZE = 10
  const MAX_COMMENT_DEPTH = 2
  const [reposted, setReposted] = useState(post.user_reposted || false)
  const [repostCount, setRepostCount] = useState(post.reposts?.[0]?.count || 0)
  const [bookmarked, setBookmarked] = useState(post.user_bookmarked || false)
  const [bookmarkLoading, setBookmarkLoading] = useState(false)
  const [showRepostMenu, setShowRepostMenu] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [quoteText, setQuoteText] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const [reactionLoading, setReactionLoading] = useState(false)
  const [commentLoading, setCommentLoading] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const [copied, setCopied] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editedContent, setEditedContent] = useState(post.content)
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')
  const [localContent, setLocalContent] = useState(post.content)
  const [localEditedAt, setLocalEditedAt] = useState<string | null>(post.edited_at ?? null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [commentError, setCommentError] = useState('')
  const commentSubmitLockRef = useRef(false)
  const reactionTriggerRef = useRef<HTMLButtonElement | null>(null)
  const reactionMenuItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const [focusedReactionIndex, setFocusedReactionIndex] = useState(0)
  const reactionMenuId = `reaction-menu-${post.id}`
  const reactionTypes = Object.keys(REACTIONS) as ReactionType[]
  // Synchronous re-entry lock for handleReact. reactionLoading (state) is
  // not enough on its own: two calls fired close enough together both read
  // reactionLoading from a render that predates either setReactionLoading(true)
  // committing, so the state-only guard can't prevent a genuine double-submit.
  // A ref is mutated and read synchronously, so it closes that window.
  const reactionRequestLockRef = useRef(false)
  // Set right before a handleReact() call resolves; consumed by the effect
  // below once reactionLoading actually flips to false and the trigger's
  // `disabled` attribute is genuinely cleared in the DOM. Calling
  // ref.focus() directly at the end of handleReact was the actual bug: it
  // ran immediately after setReactionLoading(false), which is an async
  // state update — the DOM node was still disabled={true} from the
  // previous commit at that exact moment, so the focus call silently
  // no-op'd (disabled elements can't receive focus).
  const pendingReactionFocusReturnRef = useRef(false)

  const openReactionPicker = () => {
    setShowReactionPicker(true)
  }

  const closeReactionPicker = (returnFocus = true) => {
    setShowReactionPicker(false)
    if (returnFocus) reactionTriggerRef.current?.focus()
  }

  // Move focus into the picker whenever it opens so keyboard/screen-reader
  // users land on the active
  // reaction without having to tab through every emoji. useLayoutEffect
  // (not useEffect+rAF) so focus lands synchronously in the same paint —
  // an extra animation frame of delay here was enough for fast
  // (Playwright-speed) keyboard input to race ahead of it.
  useLayoutEffect(() => {
    if (!showReactionPicker) return
    const activeIndex = Math.max(0, reactionTypes.indexOf(userReaction ?? 'like'))
    setFocusedReactionIndex(activeIndex)
    reactionMenuItemRefs.current[activeIndex]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReactionPicker])

  // Return focus to the trigger only once it is genuinely enabled again —
  // i.e. after the render where reactionLoading actually committed to
  // false, so the DOM node's disabled attribute is already cleared.
  useLayoutEffect(() => {
    if (reactionLoading) return
    if (!pendingReactionFocusReturnRef.current) return
    pendingReactionFocusReturnRef.current = false
    reactionTriggerRef.current?.focus()
  }, [reactionLoading])

  // Enter/Space on a native <button> already trigger the button's onClick
  // (which toggles open/closed) via the browser's own activation behavior —
  // handling them here too would race the same toggle through two code
  // paths. Only ArrowDown/ArrowUp (open — no native button semantics) and
  // Escape (close) are handled here.
  const handleReactionTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      openReactionPicker()
    } else if (event.key === 'Escape' && showReactionPicker) {
      event.preventDefault()
      closeReactionPicker()
    }
  }

  const handleReactionMenuKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    switch (event.key) {
      case 'ArrowRight': {
        event.preventDefault()
        const next = (index + 1) % reactionTypes.length
        setFocusedReactionIndex(next)
        reactionMenuItemRefs.current[next]?.focus()
        break
      }
      case 'ArrowLeft': {
        event.preventDefault()
        const prev = (index - 1 + reactionTypes.length) % reactionTypes.length
        setFocusedReactionIndex(prev)
        reactionMenuItemRefs.current[prev]?.focus()
        break
      }
      case 'Home': {
        event.preventDefault()
        setFocusedReactionIndex(0)
        reactionMenuItemRefs.current[0]?.focus()
        break
      }
      case 'End': {
        event.preventDefault()
        const last = reactionTypes.length - 1
        setFocusedReactionIndex(last)
        reactionMenuItemRefs.current[last]?.focus()
        break
      }
      case 'Escape': {
        event.preventDefault()
        closeReactionPicker()
        break
      }
    }
  }
  const mediaItems = (post.post_media || [])
    .map((media) => ({
      url: resolveSupabaseStorageUrl(
        (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
        media.storage_path
      ),
      type: media.media_type === 'video' ? 'video' as const : 'image' as const,
    }))
    .filter((item): item is { url: string; type: 'image' | 'video' } => Boolean(item.url))
  const mediaUrls = mediaItems.filter((item) => item.type === 'image').map((item) => item.url)
  const videoMediaUrl = mediaItems.find((item) => item.type === 'video')?.url ?? null
  const youtubeVideoId = post.youtube_video_id || extractYoutubeId(post.youtube_url) || extractYoutubeId(post.content)
  const youtubeEmbedUrl = getYoutubeEmbedUrl(post.youtube_url || post.content)
  const hidesPlainYoutubeText = !!youtubeVideoId && isOnlyYoutubeUrl(localContent)
  const avatarUrl = resolveSupabaseStorageUrl(
    (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
    post.profiles?.avatar_path
  )

  const isOwner = currentUserId === post.user_id
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'moderator'
  const canDelete = isOwner || isAdmin

  const postUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/posts/${post.id}`
    : ''

  // Primitive snapshots of the array-shaped prop fields, computed here so
  // the effect below can depend on VALUES rather than the array/object
  // references themselves. post.reactions/comments/reposts are new array
  // literals on every parent re-render (e.g. FeedListClient reconstructing
  // its posts array) even when the underlying count hasn't changed — using
  // the raw arrays as deps made this effect refire on unrelated re-renders
  // and clobber locally-set optimistic state (userReaction, reactionCount,
  // etc.) back to the original SSR snapshot.
  const postReactionCountValue = Number(post.reactions?.[0]?.count || 0)
  const postCommentCountValue = Number(post.comments?.[0]?.count || 0)
  const postRepostCountValue = Number(post.reposts?.[0]?.count || 0)

  useEffect(() => {
    setUserReaction(post.user_reaction ?? (post.user_liked ? 'like' : null))
    setReactionCount(postReactionCountValue)
    setCommentCount(postCommentCountValue)
    setReposted(Boolean(post.user_reposted))
    setRepostCount(postRepostCountValue)
    setBookmarked(Boolean(post.user_bookmarked))
    setEditedContent(post.content)
    setLocalContent(post.content)
    setLocalEditedAt(post.edited_at ?? null)
  }, [
    post.id,
    post.user_liked,
    post.user_reaction,
    post.user_reposted,
    post.user_bookmarked,
    post.content,
    post.edited_at,
    postReactionCountValue,
    postCommentCountValue,
    postRepostCountValue,
  ])

  // A plain tap on the main reaction button always targets 'like'
  // specifically (see handleReact) — it does not toggle off whatever
  // reaction is currently active. Screen-reader text must describe that
  // real outcome: removing the reaction only when it's already 'like',
  // switching to 'like' otherwise. The chevron button opens the full picker.
  const mainButtonLabel = !userReaction
    ? 'Reaguoti į įrašą (patinka)'
    : userReaction === 'like'
      ? 'Reakcija: Patinka. Paspauskite, kad pašalintumėte.'
      : `Reakcija: ${REACTIONS[userReaction].label}. Paspauskite, kad pakeistumėte į „Patinka“.`

  const handleReact = async (type: ReactionType) => {
    if (!currentUserId || reactionRequestLockRef.current) return
    reactionRequestLockRef.current = true
    const previousReaction = userReaction
    const previousCount = reactionCount
    const nextReaction: ReactionType | null = previousReaction === type ? null : type

    setReactionLoading(true)
    setShowReactionPicker(false)
    setUserReaction(nextReaction)
    setReactionCount((prev) => {
      if (previousReaction === null && nextReaction !== null) return prev + 1
      if (previousReaction !== null && nextReaction === null) return Math.max(0, prev - 1)
      return prev
    })

    const rollback = () => {
      setUserReaction(previousReaction)
      setReactionCount(previousCount)
    }

    if (nextReaction === null) {
      const { error } = await supabase.from('reactions').delete().eq('user_id', currentUserId).eq('post_id', post.id)
      if (error) rollback()
      pendingReactionFocusReturnRef.current = true
      reactionRequestLockRef.current = false
      setReactionLoading(false)
      return
    }

    const { error } = await supabase
      .from('reactions')
      .upsert({ user_id: currentUserId, post_id: post.id, type: nextReaction }, { onConflict: 'user_id,post_id' })

    if (error) {
      rollback()
      pendingReactionFocusReturnRef.current = true
      reactionRequestLockRef.current = false
      setReactionLoading(false)
      return
    }

    if (previousReaction === null && post.user_id && post.user_id !== currentUserId) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: currentUserId,
        type: nextReaction === 'like' ? 'like' : 'reaction',
        target_id: post.id,
        target_type: 'post',
      })
      await sendPushNotification(
        post.user_id,
        `${REACTIONS[nextReaction].emoji} Sureagavo į tavo įrašą`,
        post.content.slice(0, 80),
        `/u/${post.profiles?.username}`
      )
    }
    pendingReactionFocusReturnRef.current = true
    reactionRequestLockRef.current = false
    setReactionLoading(false)
  }

  // Replies (depth 1 + 2) are fetched in full for the post rather than
  // paginated per-thread — max nesting is capped at MAX_COMMENT_DEPTH, so
  // reply volume per post stays bounded. Only *top-level* threads are
  // paginated, per COMMENT_PAGE_SIZE.
  const loadRepliesFor = async () =>
    supabase
      .from('comments')
      .select('*, profiles:user_id(username, display_name, avatar_path)')
      .eq('post_id', post.id)
      .not('parent_comment_id', 'is', null)
      .order('created_at', { ascending: true })

  // The comment count embedded on the post row (post.comments[0].count)
  // reflects the state at the time the feed page was rendered; re-count
  // explicitly whenever the thread is opened/paginated so it stays
  // accurate as replies/tombstones are added. RLS (comments_read) already
  // restricts this to what the viewer may actually see (active comments,
  // their own, admin/mod, or a deleted comment that still has replies) —
  // the same visibility a plain SELECT would get, so the count matches.
  const loadCommentCount = async () => {
    const { count, error } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post.id)
    if (!error && typeof count === 'number') setCommentCount(count)
  }

  const loadComments = async () => {
    setLoadingComments(true)
    setCommentsError(false)
    const [topLevelRes, repliesRes] = await Promise.all([
      supabase
        .from('comments')
        .select('*, profiles:user_id(username, display_name, avatar_path)')
        .eq('post_id', post.id)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: true })
        .range(0, COMMENT_PAGE_SIZE - 1),
      loadRepliesFor(),
    ])
    if (topLevelRes.error || repliesRes.error) {
      setCommentsError(true)
      setLoadingComments(false)
      return
    }
    const rows = topLevelRes.data || []
    setComments(rows)
    setReplies(repliesRes.data || [])
    setCommentsHasMore(rows.length === COMMENT_PAGE_SIZE)
    setLoadingComments(false)
    void loadCommentCount()
  }

  const loadMoreComments = async () => {
    if (loadingMoreComments || !commentsHasMore) return
    setLoadingMoreComments(true)
    setCommentsError(false)
    const [topLevelRes, repliesRes] = await Promise.all([
      supabase
        .from('comments')
        .select('*, profiles:user_id(username, display_name, avatar_path)')
        .eq('post_id', post.id)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: true })
        .range(comments.length, comments.length + COMMENT_PAGE_SIZE - 1),
      loadRepliesFor(),
    ])
    if (topLevelRes.error || repliesRes.error) {
      setCommentsError(true)
      setLoadingMoreComments(false)
      return
    }
    const rows = topLevelRes.data || []
    setComments((prev) => {
      const existingIds = new Set(prev.map((c) => c.id))
      return [...prev, ...rows.filter((c) => !existingIds.has(c.id))]
    })
    // Replies are always refetched in full for the post (see loadRepliesFor)
    // so the newly-paginated-in top-level threads have their replies too.
    setReplies(repliesRes.data || [])
    setCommentsHasMore(rows.length === COMMENT_PAGE_SIZE)
    setLoadingMoreComments(false)
  }

  const toggleComments = async () => {
    if (!showComments) await loadComments()
    setShowComments(!showComments)
  }

  const startEditComment = (comment: { id: string; content: string }) => {
    setEditingCommentId(comment.id)
    setEditingCommentText(comment.content)
  }

  const cancelEditComment = () => {
    setEditingCommentId(null)
    setEditingCommentText('')
  }

  const saveEditComment = async (commentId: string) => {
    const trimmed = editingCommentText.trim()
    if (!trimmed || editingCommentLoading) return
    setEditingCommentLoading(true)
    const { data: updated, error } = await supabase
      .from('comments')
      .update({ content: trimmed })
      .eq('id', commentId)
      .eq('user_id', currentUserId)
      .select('content')
      .maybeSingle()
    if (!error && updated) {
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: updated.content } : c)))
      setReplies((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: updated.content } : c)))
      setEditingCommentId(null)
      setEditingCommentText('')
    }
    setEditingCommentLoading(false)
  }

  // Deletion is a soft delete (status -> 'deleted'), never a real removal
  // from local state: a deleted comment that has replies must keep
  // rendering as a tombstone so those replies don't become orphaned with
  // no visible parent context (see db/migrations/0010_nested_comments.sql
  // and the comments_read RLS policy it defines). A leaf deleted comment
  // (no replies) is simply not returned by RLS to other viewers, so it
  // naturally disappears from their view without any special client logic.
  const deleteComment = async (commentId: string) => {
    const inTopLevel = comments.some((c) => c.id === commentId)
    const previousComments = comments
    const previousReplies = replies
    const markDeleted = (list: any[]) =>
      list.map((c) => (c.id === commentId ? { ...c, status: 'deleted' } : c))
    if (inTopLevel) setComments(markDeleted)
    else setReplies(markDeleted)
    setDeletingCommentId(null)
    const { error } = await supabase.from('comments').update({ status: 'deleted' }).eq('id', commentId)
    if (error) {
      setComments(previousComments)
      setReplies(previousReplies)
      return
    }
    void loadCommentCount()
  }

  const submitCommentReport = async (commentId: string) => {
    if (!currentUserId || !commentReportReason.trim()) return
    await supabase.from('reports').insert({
      reporter_id: currentUserId,
      target_type: 'comment',
      target_id: commentId,
      reason: commentReportReason.trim(),
    })
    setCommentReportSentId(commentId)
    setTimeout(() => {
      setReportingCommentId(null)
      setCommentReportReason('')
      setCommentReportSentId(null)
    }, 1500)
  }

  const startReply = (comment: { id: string; depth?: number; profiles?: { display_name?: string } }) => {
    setReplyingTo({ id: comment.id, name: comment.profiles?.display_name || '' })
    commentInputRef.current?.focus()
  }

  const cancelReply = () => {
    setReplyingTo(null)
    commentInputRef.current?.focus()
  }

  const handleComment = async () => {
    if (!currentUserId || !commentText.trim() || commentLoading || commentSubmitLockRef.current) return
    commentSubmitLockRef.current = true
    setCommentLoading(true)
    setCommentError('')
    const content = commentText.trim()
    const parentCommentId = replyingTo?.id ?? null
    const isReply = Boolean(parentCommentId)
    const tempId = `temp-${Date.now()}`
    const parentDepth = isReply
      ? (comments.find((c) => c.id === parentCommentId)?.depth ?? replies.find((c) => c.id === parentCommentId)?.depth ?? 0)
      : -1

    // Optimistic update
    const optimisticComment = {
      id: tempId,
      post_id: post.id,
      user_id: currentUserId,
      content,
      parent_comment_id: parentCommentId,
      depth: parentDepth + 1,
      created_at: new Date().toISOString(),
      profiles: {
        username: '',
        display_name: 'Jūs',
        avatar_path: null,
      },
      _optimistic: true,
    }
    if (isReply) setReplies(prev => [...prev, optimisticComment])
    else setComments(prev => [...prev, optimisticComment])
    setCommentText('')
    setReplyingTo(null)
    setCommentCount(prev => prev + 1)

    const { data: newComment, error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: currentUserId,
      content,
      parent_comment_id: parentCommentId,
    }).select('id, post_id, user_id, content, parent_comment_id, depth, created_at, profiles:user_id(username, display_name, avatar_path)').single()

    if (error) {
      // Rollback: remove optimistic comment, restore text and reply context
      if (isReply) setReplies(prev => prev.filter(c => c.id !== tempId))
      else setComments(prev => prev.filter(c => c.id !== tempId))
      setCommentCount(prev => Math.max(0, prev - 1))
      setCommentText(content) // restore text
      if (isReply) setReplyingTo({ id: parentCommentId!, name: optimisticComment.profiles.display_name })
      setCommentError(isReply ? 'Nepavyko paskelbti atsakymo. Bandykite dar kartą.' : 'Nepavyko paskelbti komentaro. Bandykite dar kartą.')
      setCommentLoading(false)
      commentSubmitLockRef.current = false
      commentInputRef.current?.focus()
      return
    }

    // Replace temp comment with real one
    if (isReply) setReplies(prev => prev.map(c => c.id === tempId ? newComment : c))
    else setComments(prev => prev.map(c => c.id === tempId ? newComment : c))

    if (!showComments) {
      setShowComments(true)
    }

    // Keep focus on the comment input after a successful submission.
    commentInputRef.current?.focus()

    if (post.user_id && post.user_id !== currentUserId) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: currentUserId,
        type: 'comment',
        target_id: newComment?.id || post.id,
        target_type: newComment?.id ? 'comment' : 'post',
      })
      await sendPushNotification(
        post.user_id,
        isReply ? 'Naujas atsakymas' : 'Naujas komentaras',
        content.slice(0, 100),
        `/u/${post.profiles?.username}`
      )
    }

    await notifyMentions({
      supabase,
      content,
      actorId: currentUserId,
      targetId: newComment?.id || post.id,
      targetType: newComment?.id ? 'comment' : 'post',
      excludeUserIds: post.user_id ? [post.user_id] : [],
    })

    setCommentLoading(false)
    commentSubmitLockRef.current = false
  }

  const handleReport = async () => {
    if (!currentUserId || !reportReason.trim()) return
    await supabase.from('reports').insert({
      reporter_id: currentUserId,
      target_type: 'post',
      target_id: post.id,
      reason: reportReason.trim()
    })
    setReportSent(true)
    setTimeout(() => {
      setShowReportModal(false)
      setReportReason('')
      setReportSent(false)
    }, 1500)
  }

  const handleDelete = async () => {
    await supabase.from('posts').update({ status: 'deleted' }).eq('id', post.id)
    setDeleted(true)
    setShowDeleteConfirm(false)
    router.refresh()
  }

  const handleEdit = async () => {
    if (!currentUserId || !isOwner || editLoading) return
    const trimmed = editedContent.trim()
    if (!trimmed) {
      setEditError('Įrašas negali būti tuščias.')
      return
    }
    if (trimmed === localContent) {
      setShowEditModal(false)
      return
    }
    setEditLoading(true)
    setEditError('')
    const now = new Date().toISOString()
    const { data: updatedRow, error } = await supabase
      .from('posts')
      .update({ content: trimmed })
      .eq('id', post.id)
      .eq('user_id', currentUserId)
      .eq('status', 'active')
      .select('content')
      .maybeSingle()
    if (!error && updatedRow) {
      setLocalContent(updatedRow.content)
      setLocalEditedAt(now)
      setShowEditModal(false)
    } else {
      setEditError(error?.message || 'Nepavyko išsaugoti. Bandykite dar kartą.')
    }
    setEditLoading(false)
  }

  const notifyShare = async () => {
    if (!currentUserId || !post.user_id || post.user_id === currentUserId) return
    await supabase.from('notifications').insert({
      user_id: post.user_id,
      actor_id: currentUserId,
      type: 'share',
      target_id: post.id,
      target_type: 'post',
    })
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl)
    void notifyShare()
    setCopied(true)
    setTimeout(() => { setCopied(false); setShowShareMenu(false) }, 1500)
  }

  const handleShareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.profiles?.display_name}`,
          text: post.content?.slice(0, 100),
          url: postUrl,
        })
        await notifyShare()
      } catch {}
    }
    setShowShareMenu(false)
  }

  const shareToTwitter = () => {
    const text = encodeURIComponent(post.content?.slice(0, 200) || '')
    const url = encodeURIComponent(postUrl)
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank')
    void notifyShare()
    setShowShareMenu(false)
  }

  const shareToFacebook = () => {
    const url = encodeURIComponent(postUrl)
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank')
    void notifyShare()
    setShowShareMenu(false)
  }

  const handleRepost = async () => {
    if (!currentUserId) return

    if (reposted) {
      const { error } = await supabase
        .from('reposts')
        .delete()
        .eq('user_id', currentUserId)
        .eq('post_id', post.id)
      if (!error) {
        setReposted(false)
        setRepostCount((prev) => Math.max(0, prev - 1))
        router.refresh()
      }
      return
    }

    const { error } = await supabase.from('reposts').insert({
      user_id: currentUserId,
      post_id: post.id,
    })

    if (error) return
    setReposted(true)
    setRepostCount((prev) => prev + 1)

    if (post.user_id && post.user_id !== currentUserId) {
      await supabase.from('notifications').insert({
        user_id: post.user_id,
        actor_id: currentUserId,
        type: 'repost',
        target_id: post.id,
        target_type: 'post',
      })
    }
    router.refresh()
  }

  const handleBookmark = async () => {
    if (!currentUserId || bookmarkLoading) return
    const nextBookmarked = !bookmarked
    const previousBookmarked = bookmarked

    setBookmarkLoading(true)
    setBookmarked(nextBookmarked)

    const { error } = nextBookmarked
      ? await supabase.from('bookmarks').insert({ user_id: currentUserId, post_id: post.id })
      : await supabase.from('bookmarks').delete().eq('user_id', currentUserId).eq('post_id', post.id)

    if (error) {
      setBookmarked(previousBookmarked)
    }
    setBookmarkLoading(false)
  }

  const handleCreateQuote = async () => {
    if (!currentUserId || !quoteText.trim()) return
    setQuoteLoading(true)
    const content = quoteText.trim()
    const { data: newPost, error } = await supabase
      .from('posts')
      .insert({
        user_id: currentUserId,
        content,
        quoted_post_id: post.id,
      })
      .select('id')
      .single()

    if (!error) {
      await notifyMentions({
        supabase,
        content,
        actorId: currentUserId,
        targetId: newPost?.id || post.id,
        targetType: 'post',
        excludeUserIds: post.user_id ? [post.user_id] : [],
      })

      if (post.user_id && post.user_id !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: currentUserId,
          type: 'repost',
          target_id: post.id,
          target_type: 'post',
        })
      }

      setShowQuoteModal(false)
      setQuoteText('')
      router.refresh()
    }
    setQuoteLoading(false)
  }

  if (deleted) return null

  const repliesByParent = new Map<string, any[]>()
  for (const r of replies) {
    if (!r.parent_comment_id) continue
    if (!repliesByParent.has(r.parent_comment_id)) repliesByParent.set(r.parent_comment_id, [])
    repliesByParent.get(r.parent_comment_id)!.push(r)
  }

  const renderCommentNode = (c: any): React.ReactNode => {
    const isCommentOwner = currentUserId === c.user_id
    const canModerateComment = isCommentOwner || isAdmin
    const isEditingThis = editingCommentId === c.id
    const isTombstone = c.status === 'deleted'
    const depth: number = c.depth ?? 0
    const children = repliesByParent.get(c.id) || []
    const canReply = Boolean(currentUserId) && !isTombstone && depth < MAX_COMMENT_DEPTH

    return (
      <div key={c.id}>
        <div className={`flex gap-2 sm:gap-3 animate-fade-in-up ${c._optimistic ? 'opacity-60' : ''}`}>
          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative ring-1 ring-white shadow-sm">
            {!isTombstone && c.profiles?.avatar_path ? (
              <Image
                src={resolveSupabaseStorageUrl(
                  (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
                  c.profiles.avatar_path
                )!}
                alt=""
                fill
                sizes="32px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-xs font-bold text-blue-600">
                {isTombstone ? '·' : c.profiles?.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isTombstone ? (
              <p className="text-slate-400 text-xs sm:text-sm italic py-1">
                Komentaras ištrintas
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <Link href={`/u/${c.profiles?.username}`} className="font-bold text-xs sm:text-sm text-slate-900 hover:underline truncate">
                      {c.profiles?.display_name}
                    </Link>
                    <span className="text-slate-400 text-xs shrink-0">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {canModerateComment && !isEditingThis && (
                    <div className="flex items-center gap-1 shrink-0">
                      {isCommentOwner && (
                        <button
                          type="button"
                          onClick={() => startEditComment(c)}
                          aria-label="Redaguoti komentarą"
                          title="Redaguoti komentarą"
                          className="p-1 text-slate-300 hover:text-blue-600 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeletingCommentId(c.id)}
                        aria-label="Ištrinti komentarą"
                        title="Ištrinti komentarą"
                        className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                  {currentUserId && !isCommentOwner && (
                    <button
                      type="button"
                      onClick={() => setReportingCommentId(c.id)}
                      aria-label="Pranešti apie komentarą"
                      title="Pranešti apie komentarą"
                      className="p-1 text-slate-300 hover:text-amber-500 rounded transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0"
                    >
                      <AlertCircle size={13} />
                    </button>
                  )}
                </div>

                {isEditingThis ? (
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingCommentText}
                      onChange={(e) => setEditingCommentText(e.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void saveEditComment(c.id)
                        } else if (event.key === 'Escape') {
                          cancelEditComment()
                        }
                      }}
                      autoFocus
                      maxLength={500}
                      className="flex-1 bg-slate-50 border border-blue-300 rounded-full px-3 py-1.5 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-blue-500/10 text-slate-800 min-h-[36px]"
                    />
                    <button
                      type="button"
                      onClick={() => void saveEditComment(c.id)}
                      disabled={editingCommentLoading || !editingCommentText.trim()}
                      aria-label="Išsaugoti komentarą"
                      className="text-blue-600 disabled:opacity-50 min-w-[28px] min-h-[28px] flex items-center justify-center"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditComment}
                      aria-label="Atšaukti redagavimą"
                      className="text-slate-400 min-w-[28px] min-h-[28px] flex items-center justify-center"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-600 text-xs sm:text-sm whitespace-pre-wrap break-words">
                    <ParsedContent content={c.content} />
                  </p>
                )}

                {!isEditingThis && (
                  <div className="mt-1 flex items-center gap-3">
                    {canReply && (
                      <button
                        type="button"
                        onClick={() => startReply(c)}
                        aria-label={`Atsakyti ${c.profiles?.display_name || ''}`}
                        className="text-xs font-semibold text-slate-400 hover:text-blue-600 transition-colors min-h-[28px]"
                      >
                        Atsakyti
                      </button>
                    )}
                  </div>
                )}

                {deletingCommentId === c.id && (
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                    <span className="text-xs text-red-600">Ištrinti komentarą?</span>
                    <button
                      type="button"
                      onClick={() => void deleteComment(c.id)}
                      className="text-xs font-semibold text-red-600 hover:underline min-h-[28px]"
                    >
                      Ištrinti
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCommentId(null)}
                      className="text-xs font-semibold text-slate-500 hover:underline min-h-[28px]"
                    >
                      Atšaukti
                    </button>
                  </div>
                )}

                {reportingCommentId === c.id && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    {commentReportSentId === c.id ? (
                      <p className="text-xs font-semibold text-emerald-600">Pranešimas išsiųstas. Ačiū!</p>
                    ) : (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentReportReason}
                          onChange={(e) => setCommentReportReason(e.target.value)}
                          placeholder="Kodėl pranešate?"
                          maxLength={500}
                          className="flex-1 bg-white border border-slate-200 rounded-full px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-500/10 min-h-[36px]"
                        />
                        <button
                          type="button"
                          onClick={() => void submitCommentReport(c.id)}
                          disabled={!commentReportReason.trim()}
                          className="text-xs font-semibold text-amber-600 hover:underline disabled:opacity-50 min-h-[28px]"
                        >
                          Siųsti
                        </button>
                        <button
                          type="button"
                          onClick={() => { setReportingCommentId(null); setCommentReportReason('') }}
                          className="text-xs font-semibold text-slate-500 hover:underline min-h-[28px]"
                        >
                          Atšaukti
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        {children.length > 0 && (
          <div className="ml-9 sm:ml-11 mt-2 space-y-2 border-l-2 border-slate-100 pl-3 sm:pl-4">
            {children.map((child) => renderCommentNode(child))}
          </div>
        )}
      </div>
    )
  }

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
  const repostTimeAgo = post.reposted_at ? formatDistanceToNow(new Date(post.reposted_at), { addSuffix: true }) : null

  return (
    <div data-testid="post-card" data-post-id={post.id} className="group p-4 sm:p-5 hover:bg-slate-50/80 transition-all duration-200 animate-fade-in-up">
      <div className="flex gap-3 sm:gap-4">
        <Link href={`/u/${post.profiles?.username}`} className="flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center overflow-hidden relative ring-2 ring-white shadow-sm">
            {post.profiles?.avatar_path ? (
              <Image
                src={avatarUrl!}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-base sm:text-lg font-bold text-blue-600">
                {post.profiles?.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          {post.reposted_by_profile && (
            <div className="mb-1 text-xs text-emerald-600 font-medium">
              <Link href={`/u/${post.reposted_by_profile.username}`} className="hover:underline font-semibold">
                @{post.reposted_by_profile.username}
              </Link>{' '}
              reposted {repostTimeAgo || ''}
            </div>
          )}
          <div className="flex items-center justify-between mb-1 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <Link href={`/u/${post.profiles?.username}`} className="font-bold text-slate-900 hover:underline text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">
                {post.profiles?.display_name}
              </Link>
              <Link href={`/u/${post.profiles?.username}`} className="text-slate-400 text-xs sm:text-sm hover:underline hidden sm:inline truncate max-w-[100px]">
                @{post.profiles?.username}
              </Link>
              <span className="text-slate-400 text-xs sm:text-sm shrink-0">&middot; {timeAgo}</span>
            </div>
            {canDelete && (
              <div className="flex items-center gap-1">
                {isOwner && (
                  <button
                    onClick={() => { setEditedContent(localContent); setShowEditModal(true) }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Redaguoti įrašą"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-200 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Ištrinti įrašą"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {!hidesPlainYoutubeText && (
            <p className="text-slate-800 text-[15px] leading-relaxed whitespace-pre-wrap mb-1">
              <ParsedContent content={localContent} />
            </p>
          )}
          {localEditedAt && (
            <p className="text-xs text-slate-400 mb-3">
              edited {formatDistanceToNow(new Date(localEditedAt), { addSuffix: true })}
            </p>
          )}

          {post.quoted_post && post.quoted_post.status !== 'deleted' && (
            <div className="mb-3 rounded-2xl border border-slate-200 p-3 sm:p-4 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer">
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/u/${post.quoted_post.profiles?.username}`} className="text-sm font-semibold text-slate-800 hover:underline">
                  {post.quoted_post.profiles?.display_name}
                </Link>
                <span className="text-xs text-slate-400">
                  @{post.quoted_post.profiles?.username}
                </span>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap break-words">
                <ParsedContent content={post.quoted_post.content} />
              </p>
            </div>
          )}

          {mediaUrls.length > 0 && (
            <div className={`grid gap-2 mb-3 rounded-2xl overflow-hidden ${mediaUrls.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {mediaUrls.map((src, i) => (
                <div
                  key={i}
                  className="relative w-full h-48 sm:h-64 overflow-hidden cursor-pointer bg-slate-100 rounded-xl"
                  onClick={() => setLightboxIndex(i)}
                >
                  <PostMediaImage src={src} />
                </div>
              ))}
            </div>
          )}

          {lightboxIndex !== null && mediaUrls.length > 0 && (
            <ImageLightbox
              images={mediaUrls}
              initialIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
            />
          )}

          {videoMediaUrl && (
            // aspect-video fixes the box's height before the video's own
            // metadata loads, preventing layout shift — same technique as
            // the YouTube embed just below. No autoPlay (with or without
            // sound) and no loop; native `controls` gives accessible
            // keyboard/screen-reader-operable playback controls for free.
            <div className="mb-3 aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-black">
              <video
                src={videoMediaUrl}
                className="h-full w-full"
                controls
                muted
                preload="metadata"
                aria-label="Įrašo vaizdo įrašas"
              >
                Jūsų naršyklė nepalaiko vaizdo įrašų atkūrimo.
              </video>
            </div>
          )}

          {youtubeEmbedUrl && (
            <div className="mb-3 aspect-video rounded-2xl overflow-hidden border border-slate-200 bg-black">
              <iframe
                width="100%" height="100%"
                src={youtubeEmbedUrl}
                title="YouTube"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-4 text-slate-400">
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => void handleReact('like')}
                disabled={reactionLoading}
                aria-label={mainButtonLabel}
                aria-pressed={Boolean(userReaction)}
                title={userReaction ? REACTIONS[userReaction].label : 'Reaguoti (paspauskite „Patinka“ arba atverkite visas reakcijas)'}
                className={`flex items-center gap-1.5 sm:gap-2 transition-all duration-200 min-h-[44px] hover:scale-110 disabled:opacity-60 ${userReaction ? 'text-[#E94560]' : 'hover:text-[#E94560]'}`}
              >
                {userReaction && userReaction !== 'like' ? (
                  <span className="text-lg leading-none" aria-hidden="true">{REACTIONS[userReaction].emoji}</span>
                ) : (
                  <Heart size={20} fill={userReaction === 'like' ? 'currentColor' : 'none'} className={userReaction === 'like' ? 'animate-like' : ''} />
                )}
                <span className="text-sm font-medium">{Number.isFinite(reactionCount) ? reactionCount : 0}</span>
              </button>
              <button
                ref={reactionTriggerRef}
                type="button"
                data-testid="reaction-picker-trigger"
                onClick={() => (showReactionPicker ? closeReactionPicker(false) : openReactionPicker())}
                onKeyDown={handleReactionTriggerKeyDown}
                disabled={reactionLoading}
                aria-haspopup="menu"
                aria-expanded={showReactionPicker}
                aria-controls={reactionMenuId}
                aria-label="Atidaryti reakcijų pasirinkimą"
                title="Daugiau reakcijų"
                className="flex items-center justify-center min-w-[44px] min-h-[44px] text-slate-300 hover:text-[#E94560] disabled:opacity-60 transition-colors"
              >
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {showReactionPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => closeReactionPicker(false)} />
                  <div
                    id={reactionMenuId}
                    data-testid="reaction-picker-menu"
                    role="menu"
                    aria-label="Pasirinkite reakciją"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                        setShowReactionPicker(false)
                      }
                    }}
                    className="absolute bottom-11 left-0 flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150"
                  >
                    {reactionTypes.map((type, index) => (
                      <button
                        key={type}
                        ref={(el) => { reactionMenuItemRefs.current[index] = el }}
                        type="button"
                        data-testid={`reaction-option-${type}`}
                        role="menuitemradio"
                        aria-checked={userReaction === type}
                        tabIndex={index === focusedReactionIndex ? 0 : -1}
                        onFocus={() => setFocusedReactionIndex(index)}
                        onClick={() => void handleReact(type)}
                        onKeyDown={(event) => handleReactionMenuKeyDown(event, index)}
                        title={REACTIONS[type].label}
                        aria-label={userReaction === type ? `${REACTIONS[type].label} (pasirinkta). Paspauskite, kad pašalintumėte.` : REACTIONS[type].label}
                        className={`flex h-11 w-11 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${userReaction === type ? 'bg-slate-100' : ''}`}
                      >
                        {REACTIONS[type].emoji}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <button type="button" onClick={toggleComments} aria-expanded={showComments} aria-label={showComments ? 'Slėpti komentarus' : 'Rodyti komentarus'} className={`flex items-center gap-1.5 sm:gap-2 transition-all duration-200 min-h-[44px] hover:scale-110 ${showComments ? 'text-blue-500' : 'hover:text-blue-500'}`}>
              <MessageCircle size={20} />
              <span className="text-sm font-medium">{commentCount}</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowRepostMenu(!showRepostMenu)}
                aria-haspopup="menu"
                aria-expanded={showRepostMenu}
                aria-label={reposted ? 'Pakartotinio paskelbimo parinktys (jau pakartota)' : 'Pakartotinai paskelbti arba cituoti'}
                className={`flex items-center gap-1.5 sm:gap-2 transition-all duration-200 min-h-[44px] hover:scale-110 ${reposted ? 'text-emerald-600' : 'hover:text-emerald-600'}`}
              >
                <Repeat2 size={20} />
                <span className="text-sm font-medium">{repostCount}</span>
              </button>
              {showRepostMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRepostMenu(false)} />
                  <div className="absolute bottom-8 left-0 bg-white rounded-xl shadow-lg border border-slate-200 py-2 w-44 z-50">
                    <button
                      onClick={async () => {
                        await handleRepost()
                        setShowRepostMenu(false)
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors text-slate-700 min-h-[44px]"
                    >
                      {reposted ? 'Undo repost' : 'Repost'}
                    </button>
                    <button
                      onClick={() => {
                        setShowRepostMenu(false)
                        setShowQuoteModal(true)
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 transition-colors text-slate-700 min-h-[44px]"
                    >
                      Quote
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* Share */}
            <div className="relative">
              <button
                onClick={() => setShowShareMenu(!showShareMenu)}
                aria-haspopup="menu"
                aria-expanded={showShareMenu}
                aria-label="Dalintis įrašu"
                className="flex items-center gap-2 hover:text-emerald-600 transition-all duration-200 min-h-[44px] hover:scale-110"
              >
                <Share2 size={20} />
              </button>
              {showShareMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                  <div className="absolute bottom-8 left-0 sm:left-1/2 sm:-translate-x-1/2 bg-white rounded-xl shadow-lg border border-slate-200 py-2 w-48 z-50">
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors text-slate-700 min-h-[44px]"
                    >
                      {copied ? <Check size={16} className="text-emerald-500" /> : <LinkIcon size={16} />}
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        onClick={handleShareNative}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors text-slate-700 min-h-[44px]"
                      >
                        <Share2 size={16} />
                        Share via...
                      </button>
                    )}
                    <button
                      onClick={shareToTwitter}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors text-slate-700 min-h-[44px]"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      Post on X
                    </button>
                    <button
                      onClick={shareToFacebook}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 flex items-center gap-3 transition-colors text-slate-700 min-h-[44px]"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Share on Facebook
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* Bookmark */}
            {currentUserId && (
              <button
                type="button"
                onClick={handleBookmark}
                disabled={bookmarkLoading}
                title={bookmarked ? 'Pašalinti iš išsaugotų' : 'Išsaugoti įrašą'}
                aria-label={bookmarked ? 'Pašalinti iš išsaugotų' : 'Išsaugoti įrašą'}
                aria-pressed={bookmarked}
                className={`flex items-center gap-2 transition-all duration-200 min-h-[44px] hover:scale-110 disabled:opacity-60 ${bookmarked ? 'text-amber-500' : 'hover:text-amber-500'}`}
              >
                <Bookmark size={20} fill={bookmarked ? 'currentColor' : 'none'} />
              </button>
            )}
            {/* Report */}
            {currentUserId && !isOwner && (
              <button
                onClick={() => setShowReportModal(true)}
                aria-label="Pranešti apie įrašą"
                className="flex items-center gap-2 text-slate-400 hover:text-amber-500 transition-all duration-200 ml-auto min-h-[44px] hover:scale-110"
              >
                <AlertCircle size={18} />
              </button>
            )}
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 sm:mt-4 space-y-3 border-t border-slate-100 pt-3 sm:pt-4">
              {loadingComments && comments.length === 0 ? (
                <div className="space-y-2 py-2">
                  <div className="flex gap-2 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-slate-200" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-slate-200 rounded w-1/4" />
                      <div className="h-3 bg-slate-200 rounded w-3/4" />
                    </div>
                  </div>
                </div>
              ) : commentsError && comments.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <p className="text-sm text-slate-500">Nepavyko įkelti komentarų.</p>
                  <button
                    type="button"
                    onClick={loadComments}
                    className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 min-h-[36px] transition-all"
                  >
                    Bandyti dar kartą
                  </button>
                </div>
              ) : (
                <>
                  {comments.map((c) => renderCommentNode(c))}

                  {comments.length === 0 && (
                    <div className="text-center py-4">
                      <MessageCircle size={24} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">Komentarų dar nėra. Būkite pirmi!</p>
                    </div>
                  )}
                  {commentsHasMore && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={loadMoreComments}
                        disabled={loadingMoreComments}
                        className="px-4 py-2 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-60 min-h-[36px] transition-all"
                      >
                        {loadingMoreComments ? 'Kraunama...' : 'Rodyti daugiau komentarų'}
                      </button>
                    </div>
                  )}
                  {commentsError && comments.length > 0 && (
                    <p className="text-center text-xs text-slate-400">Nepavyko įkelti daugiau komentarų. Bandykite dar kartą.</p>
                  )}
                </>
              )}

              {currentUserId && (
                <>
                  {replyingTo && (
                    <div className="flex items-center justify-between gap-2 rounded-full bg-blue-50 px-3 sm:px-4 py-1.5 text-xs text-blue-700">
                      <span className="truncate">
                        Atsakoma {replyingTo.name ? `vartotojui ${replyingTo.name}` : 'į komentarą'}
                      </span>
                      <button
                        type="button"
                        onClick={cancelReply}
                        aria-label="Atšaukti atsakymą"
                        className="text-blue-700 hover:text-blue-900 min-w-[24px] min-h-[24px] flex items-center justify-center shrink-0"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  <form
                    className="flex gap-2 mt-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      void handleComment()
                    }}
                  >
                    <div className="flex-1 relative">
                      {commentError && (
                        <p className="text-xs text-red-500 mb-1 px-3">{commentError}</p>
                      )}
                      <input
                        ref={commentInputRef}
                        type="text"
                        value={commentText}
                        onChange={e => { setCommentText(e.target.value); setCommentError('') }}
                        placeholder={replyingTo ? 'Parašykite atsakymą...' : 'Parašykite komentarą...'}
                        aria-label={replyingTo ? `Atsakymo tekstas${replyingTo.name ? ` vartotojui ${replyingTo.name}` : ''}` : 'Komentaro tekstas'}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape' && replyingTo) {
                            event.preventDefault()
                            cancelReply()
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-full px-3 sm:px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 text-slate-800 min-h-[44px] placeholder:text-slate-400 transition-all"
                        maxLength={500}
                        disabled={commentLoading}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!commentText.trim() || commentLoading}
                      aria-label={replyingTo ? 'Paskelbti atsakymą' : 'Paskelbti komentarą'}
                      className="bg-[#1A1A2E] text-white p-2 rounded-full hover:bg-[#16213E] disabled:opacity-50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center shadow-sm hover:shadow-md self-end"
                    >
                      <Send size={16} />
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {/* Quote Modal */}
          {showQuoteModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowQuoteModal(false)}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Quote Post</h3>
                  <button onClick={() => setShowQuoteModal(false)} className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <textarea
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Add your comment..."
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 resize-none min-h-[110px] bg-slate-50 text-slate-800"
                  maxLength={2000}
                />
                <div className="mt-3 rounded-xl border border-slate-200 p-3 bg-slate-50">
                  <p className="text-xs text-slate-400 mb-1">
                    @{post.profiles?.username}
                  </p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                    <ParsedContent content={post.content} />
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowQuoteModal(false)}
                    className="px-4 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold min-h-[44px] hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateQuote}
                    disabled={quoteLoading || !quoteText.trim()}
                    className="px-5 py-2.5 rounded-full bg-[#1A1A2E] hover:bg-[#16213E] text-white font-semibold disabled:opacity-50 min-h-[44px] transition-all shadow-sm"
                  >
                    {quoteLoading ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowEditModal(false)}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Redaguoti įrašą</h3>
                  <button onClick={() => { setShowEditModal(false); setEditError('') }} className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors">
                    <X size={20} />
                  </button>
                </div>
                <textarea
                  value={editedContent}
                  onChange={(e) => { setEditedContent(e.target.value); setEditError('') }}
                  placeholder="Ką galvojate?"
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-500/10 resize-none min-h-[120px] bg-slate-50 text-slate-800"
                  maxLength={2000}
                  autoFocus
                />
                {editError && (
                  <p className="mt-2 text-sm text-red-500">{editError}</p>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => { setShowEditModal(false); setEditError('') }}
                    className="px-4 py-2.5 rounded-full border border-slate-200 text-slate-700 font-semibold min-h-[44px] hover:bg-slate-50 transition-colors"
                  >
                    Atšaukti
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={editLoading || !editedContent.trim()}
                    className="px-5 py-2.5 rounded-full bg-[#1A1A2E] hover:bg-[#16213E] text-white font-semibold disabled:opacity-50 min-h-[44px] transition-all shadow-sm"
                  >
                    {editLoading ? 'Saugoma...' : 'Išsaugoti'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowDeleteConfirm(false)}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-2 text-slate-900">Ištrinti įrašą?</h3>
                <p className="text-slate-500 text-sm mb-4 sm:mb-6">Šio veiksmo negalima atšaukti. Įrašas bus pašalintas.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-full font-semibold hover:bg-slate-50 transition-colors min-h-[44px]"
                  >
                    Atšaukti
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 bg-red-500 text-white py-2.5 rounded-full font-semibold hover:bg-red-600 transition-colors min-h-[44px]"
                  >
                    Ištrinti
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Report Modal */}
          {showReportModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowReportModal(false)}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-slate-900">Report Post</h3>
                  <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-slate-600 min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors">
                    <X size={20} />
                  </button>
                </div>
                {reportSent ? (
                  <p className="text-emerald-600 font-bold text-center py-4">Report submitted. Thank you!</p>
                ) : (
                  <>
                    <textarea
                      value={reportReason}
                      onChange={e => setReportReason(e.target.value)}
                      placeholder="Why are you reporting this post?"
                      className="w-full border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-red-300 focus:ring-2 focus:ring-red-500/10 resize-none min-h-[100px] bg-slate-50 text-slate-800"
                      maxLength={500}
                    />
                    <button
                      onClick={handleReport}
                      disabled={!reportReason.trim()}
                      className="mt-3 w-full bg-red-500 text-white py-2.5 rounded-full font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors min-h-[44px]"
                    >
                      Submit Report
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
