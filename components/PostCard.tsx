'use client'
import { createClient } from '@/lib/backend-client'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
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
    post_media?: { storage_path: string }[]
    quoted_post?: {
      id: string
      content: string
      youtube_video_id?: string
      status?: string
      profiles?: { username: string; display_name: string; avatar_path?: string }
      post_media?: { storage_path: string }[]
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
  const [focusedReactionIndex, setFocusedReactionIndex] = useState(0)
  const reactionPickerTriggerRef = useRef<HTMLButtonElement>(null)
  const reactionMenuRef = useRef<HTMLDivElement>(null)
  const reactionItemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count || 0)
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
  const [replyToComment, setReplyToComment] = useState<{id: string, display_name: string} | null>(null)
  const [commentError, setCommentError] = useState('')
  const [commentOffset, setCommentOffset] = useState(0)
  const [hasMoreComments, setHasMoreComments] = useState(false)
  const [showDeleteCommentConfirm, setShowDeleteCommentConfirm] = useState<string | null>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)
  const commentSubmitLockRef = useRef(false)
  const COMMENTS_PAGE_SIZE = 10

  const mediaUrls = (post.post_media || [])
    .map((media) => resolveSupabaseStorageUrl(
      (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
      media.storage_path
    ))
    .filter((value): value is string => Boolean(value))
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

  useEffect(() => {
    setUserReaction(post.user_reaction ?? (post.user_liked ? 'like' : null))
    setReactionCount(Number(post.reactions?.[0]?.count || 0))
    setCommentCount(Number(post.comments?.[0]?.count || 0))
    setReposted(Boolean(post.user_reposted))
    setRepostCount(Number(post.reposts?.[0]?.count || 0))
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
    post.reactions,
    post.comments,
    post.reposts,
  ])

  // Focus moves into the picker when opened
  useEffect(() => {
    if (showReactionPicker && reactionMenuRef.current) {
      const firstItem = reactionItemRefs.current[0]
      if (firstItem) {
        firstItem.focus()
        setFocusedReactionIndex(0)
      }
    }
  }, [showReactionPicker])

  // Close picker on Escape and click outside; arrow-key navigation
  useEffect(() => {
    if (!showReactionPicker) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowReactionPicker(false)
        reactionPickerTriggerRef.current?.focus()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setFocusedReactionIndex((prev) => {
          const next = (prev + 1) % reactionTypes.length
          reactionItemRefs.current[next]?.focus()
          return next
        })
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setFocusedReactionIndex((prev) => {
          const next = (prev - 1 + reactionTypes.length) % reactionTypes.length
          reactionItemRefs.current[next]?.focus()
          return next
        })
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      const menu = reactionMenuRef.current
      const trigger = reactionPickerTriggerRef.current
      if (menu && !menu.contains(e.target as Node) && trigger && !trigger.contains(e.target as Node)) {
        setShowReactionPicker(false)
        reactionPickerTriggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showReactionPicker])

  const toggleReactionPicker = useCallback(() => {
    setShowReactionPicker((prev) => !prev)
  }, [])

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

  const reactionTypes = Object.keys(REACTIONS) as ReactionType[]

  const handleReact = async (type: ReactionType) => {
    if (!currentUserId || reactionLoading) return
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
      setReactionLoading(false)
      // Return focus to trigger after removing reaction
      reactionPickerTriggerRef.current?.focus()
      return
    }

    const { error } = await supabase
      .from('reactions')
      .upsert({ user_id: currentUserId, post_id: post.id, type: nextReaction }, { onConflict: 'user_id,post_id' })

    if (error) {
      rollback()
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
    setReactionLoading(false)
    // Return focus to trigger after selecting a reaction
    reactionPickerTriggerRef.current?.focus()
  }

  const loadComments = async () => {
    setLoadingComments(true)
    const { data, count } = await supabase
      .from('comments')
      .select('*, profiles:user_id(username, display_name, avatar_path), parent_comment_id', { count: 'exact' })
      .eq('post_id', post.id)
      .eq('status', 'active')
      .is('parent_comment_id', null)
      .order('created_at', { ascending: true })
      .range(0, 9)

    const topLevelIds = (data || []).map((c: any) => c.id)
    let replies: any[] = []
    if (topLevelIds.length > 0) {
      const { data: replyData } = await supabase
        .from('comments')
        .select('*, profiles:user_id(username, display_name, avatar_path), parent_comment_id')
        .eq('post_id', post.id)
        .eq('status', 'active')
        .in('parent_comment_id', topLevelIds)
        .order('created_at', { ascending: true })
      replies = replyData || []
    }

    const rows = [...(data || []), ...replies]
    setComments(rows)
    setCommentCount(count || rows.length)
    setHasMoreComments((count || 0) > 10)
    setCommentOffset(10)
    setLoadingComments(false)
  }

  const toggleComments = async () => {
    if (!showComments) await loadComments()
    setShowComments(!showComments)
  }

  const handleComment = async () => {
    if (!currentUserId || !commentText.trim() || commentLoading || commentSubmitLockRef.current) return
    commentSubmitLockRef.current = true
    setCommentLoading(true)
    setCommentError('')
    const content = commentText.trim()
    const tempId = `temp-${Date.now()}`
    const parentCommentId = replyToComment?.id || null

    // Optimistic update
    const optimisticComment = {
      id: tempId,
      post_id: post.id,
      user_id: currentUserId,
      content,
      created_at: new Date().toISOString(),
      parent_comment_id: parentCommentId,
      profiles: {
        username: '',
        display_name: 'Jūs',
        avatar_path: null,
      },
      _optimistic: true,
    }
    setComments(prev => [...prev, optimisticComment])
    setCommentText('')
    setReplyToComment(null)
    setCommentCount(prev => prev + 1)

    const { data: newComment, error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: currentUserId,
      content,
      parent_comment_id: parentCommentId,
    }).select('id, post_id, user_id, content, created_at, parent_comment_id, profiles:user_id(username, display_name, avatar_path)').single()

    if (error) {
      // Rollback: remove optimistic comment
      setComments(prev => prev.filter(c => c.id !== tempId))
      setCommentCount(prev => Math.max(0, prev - 1))
      setCommentText(content) // restore text
      setCommentError('Nepavyko paskelbti komentaro. Bandykite dar kartą.')
      setCommentLoading(false)
      commentSubmitLockRef.current = false
      return
    }

    // Replace temp comment with real one
    setComments(prev => prev.map(c => c.id === tempId ? newComment : c))

    if (!showComments) {
      setShowComments(true)
    }

    // Focus back to input after reply
    setTimeout(() => {
      commentInputRef.current?.focus()
    }, 0)

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
        'Naujas komentaras',
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

  const handleLoadMoreComments = async () => {
    if (loadingComments) return
    setLoadingComments(true)
    const { data, count } = await supabase
      .from('comments')
      .select('*, profiles:user_id(username, display_name, avatar_path), parent_comment_id', { count: 'exact' })
      .eq('post_id', post.id)
      .eq('status', 'active')
      .is('parent_comment_id', null)
      .order('created_at', { ascending: true })
      .range(commentOffset, commentOffset + 9)

    const topLevelIds = (data || []).map((c: any) => c.id)
    let replies: any[] = []
    if (topLevelIds.length > 0) {
      const { data: replyData } = await supabase
        .from('comments')
        .select('*, profiles:user_id(username, display_name, avatar_path), parent_comment_id')
        .eq('post_id', post.id)
        .eq('status', 'active')
        .in('parent_comment_id', topLevelIds)
        .order('created_at', { ascending: true })
      replies = replyData || []
    }

    const rows = [...(data || []), ...replies]
    setComments(prev => [...prev, ...rows])
    setCommentCount(count || rows.length)
    setHasMoreComments((count || 0) > commentOffset + 10)
    setCommentOffset(prev => prev + 10)
    setLoadingComments(false)
  }

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase
      .from('comments')
      .update({ status: 'deleted' })
      .eq('id', commentId)
    if (!error) {
      setComments(prev => prev.filter(c => c.id !== commentId))
      setCommentCount(prev => Math.max(0, prev - 1))
    }
    setShowDeleteCommentConfirm(null)
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
                title={userReaction ? REACTIONS[userReaction].label : 'Patinka'}
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
                type="button"
                ref={reactionPickerTriggerRef}
                onClick={toggleReactionPicker}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggleReactionPicker()
                  }
                }}
                aria-expanded={showReactionPicker}
                aria-controls="reaction-picker-menu"
                aria-label="Atidaryti reakcijų pasirinkimą"
                title="Daugiau reakcijų"
                className={`ml-0.5 flex items-center justify-center rounded-full p-0.5 transition-all duration-200 min-h-[28px] min-w-[28px] hover:bg-slate-100 ${showReactionPicker ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <ChevronDown size={14} />
              </button>
              {showReactionPicker && (
                <div
                  id="reaction-picker-menu"
                  ref={reactionMenuRef}
                  role="menu"
                  aria-label="Pasirinkite reakciją"
                  className="absolute bottom-11 left-0 flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  {reactionTypes.map((type, index) => (
                    <button
                      key={type}
                      type="button"
                      ref={(el) => { reactionItemRefs.current[index] = el }}
                      role="menuitemradio"
                      aria-checked={userReaction === type}
                      onClick={() => void handleReact(type)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          void handleReact(type)
                        }
                      }}
                      title={REACTIONS[type].label}
                      aria-label={REACTIONS[type].label}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-blue-400 ${userReaction === type ? 'bg-slate-100' : ''}`}
                    >
                      {REACTIONS[type].emoji}
                    </button>
                  ))}
                </div>
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
              ) : (
                <>
                  {(() => {
                    const topLevel = comments.filter(c => !c.parent_comment_id)
                    const repliesByParent = comments
                      .filter(c => c.parent_comment_id)
                      .reduce((acc, c) => {
                        acc[c.parent_comment_id] = acc[c.parent_comment_id] || []
                        acc[c.parent_comment_id].push(c)
                        return acc
                      }, {} as Record<string, any[]>)

                    return topLevel.map((c) => (
                      <div key={c.id} className="space-y-2">
                        {/* Top-level comment */}
                        <div className={`flex gap-2 sm:gap-3 animate-fade-in-up ${c._optimistic ? 'opacity-60' : ''}`}>
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative ring-1 ring-white shadow-sm">
                            {c.profiles?.avatar_path ? (
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
                                {c.profiles?.display_name?.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Link href={`/u/${c.profiles?.username}`} className="font-bold text-xs sm:text-sm text-slate-900 hover:underline">
                                {c.profiles?.display_name}
                              </Link>
                              <span className="text-slate-400 text-xs">
                                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-slate-600 text-xs sm:text-sm whitespace-pre-wrap break-words">
                              <ParsedContent content={c.content} />
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <button
                                onClick={() => setReplyToComment({ id: c.id, display_name: c.profiles?.display_name || 'Anonimas' })}
                                className="text-xs text-slate-400 hover:text-blue-500 transition-colors"
                              >
                                Atsakyti
                              </button>
                              {(currentUserId === c.user_id || isAdmin) && (
                                <button
                                  onClick={() => setShowDeleteCommentConfirm(c.id)}
                                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  Ištrinti
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        {/* Replies */}
                        {(repliesByParent[c.id] || []).map((reply: any) => (
                          <div key={reply.id} className={`flex gap-2 sm:gap-3 ml-6 sm:ml-8 pl-3 border-l-2 border-slate-200 animate-fade-in-up ${reply._optimistic ? 'opacity-60' : ''}`}>
                            <div className="w-6 h-6 sm:w-7 sm:h-7 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative ring-1 ring-white shadow-sm">
                              {reply.profiles?.avatar_path ? (
                                <Image
                                  src={resolveSupabaseStorageUrl(
                                    (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
                                    reply.profiles.avatar_path
                                  )!}
                                  alt=""
                                  fill
                                  sizes="28px"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <span className="text-[10px] font-bold text-blue-600">
                                  {reply.profiles?.display_name?.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 sm:gap-2">
                                <Link href={`/u/${reply.profiles?.username}`} className="font-bold text-xs text-slate-900 hover:underline">
                                  {reply.profiles?.display_name}
                                </Link>
                                <span className="text-slate-400 text-[10px]">
                                  {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-slate-600 text-xs whitespace-pre-wrap break-words">
                                <ParsedContent content={reply.content} />
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <button
                                  onClick={() => setReplyToComment({ id: c.id, display_name: reply.profiles?.display_name || 'Anonimas' })}
                                  className="text-[10px] text-slate-400 hover:text-blue-500 transition-colors"
                                >
                                  Atsakyti
                                </button>
                                {(currentUserId === reply.user_id || isAdmin) && (
                                  <button
                                    onClick={() => setShowDeleteCommentConfirm(reply.id)}
                                    className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                                  >
                                    Ištrinti
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                  {comments.length === 0 && (
                    <div className="text-center py-4">
                      <MessageCircle size={24} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-sm text-slate-400">No comments yet. Be the first!</p>
                    </div>
                  )}
                  {hasMoreComments && (
                    <button
                      onClick={handleLoadMoreComments}
                      disabled={loadingComments}
                      className="w-full py-2 text-sm text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {loadingComments ? 'Kraunama...' : 'Rodyti daugiau komentarų'}
                    </button>
                  )}
                </>
              )}

              {currentUserId && (
                <form
                  className="flex gap-2 mt-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    void handleComment()
                  }}
                >
                  <div className="flex-1 relative">
                    {replyToComment && (
                      <div className="flex items-center gap-1 mb-1 px-3">
                        <span className="text-xs text-blue-500">
                          Atsakote į {replyToComment.display_name}...
                        </span>
                        <button
                          type="button"
                          onClick={() => setReplyToComment(null)}
                          className="text-xs text-slate-400 hover:text-slate-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    {commentError && (
                      <p className="text-xs text-red-500 mb-1 px-3">{commentError}</p>
                    )}
                    <input
                      ref={commentInputRef}
                      type="text"
                      value={commentText}
                      onChange={e => { setCommentText(e.target.value); setCommentError('') }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          void handleComment()
                        }
                      }}
                      placeholder={replyToComment ? `Atsakote į ${replyToComment.display_name}...` : 'Parašykite komentarą...'}
                      className="w-full bg-slate-50 border border-slate-200 rounded-full px-3 sm:px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 text-slate-800 min-h-[44px] placeholder:text-slate-400 transition-all"
                      maxLength={500}
                      disabled={commentLoading}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!commentText.trim() || commentLoading}
                    aria-label="Paskelbti komentarą"
                    className="bg-[#1A1A2E] text-white p-2 rounded-full hover:bg-[#16213E] disabled:opacity-50 transition-all min-w-[44px] min-h-[44px] flex items-center justify-center shadow-sm hover:shadow-md self-end"
                  >
                    <Send size={16} />
                  </button>
                </form>
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

          {/* Delete Comment Confirmation Modal */}
          {showDeleteCommentConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4" onClick={() => setShowDeleteCommentConfirm(null)}>
              <div className="bg-white rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-2 text-slate-900">Ištrinti komentarą?</h3>
                <p className="text-slate-500 text-sm mb-4 sm:mb-6">Šio veiksmo negalima atšaukti. Komentaras bus pašalintas.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteCommentConfirm(null)}
                    className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-full font-semibold hover:bg-slate-50 transition-colors min-h-[44px]"
                  >
                    Atšaukti
                  </button>
                  <button
                    onClick={() => handleDeleteComment(showDeleteCommentConfirm)}
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
