'use client'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, MessageCircle, AlertCircle, Send, X, Share2, Trash2, Check, Link as LinkIcon, Repeat2, Pencil } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import ImageLightbox from './ImageLightbox'
import ParsedContent from '@/lib/parseContent'
import { notifyMentions } from '@/lib/mentions'
import { sendPushNotification } from '@/lib/pushNotify'

function extractYoutubeId(value?: string | null) {
  if (!value) return null

  try {
    const parsed = new URL(value)
    const hostname = parsed.hostname.replace(/^www\./, '')

    if (hostname === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id?.length === 11 ? id : null
    }

    if (hostname === 'youtube.com' || hostname === 'm.youtube.com') {
      const fromQuery = parsed.searchParams.get('v')
      if (fromQuery?.length === 11) return fromQuery

      const segments = parsed.pathname.split('/').filter(Boolean)
      const candidate = segments[1]
      if (['embed', 'shorts', 'live', 'v'].includes(segments[0]) && candidate?.length === 11) {
        return candidate
      }
    }
  } catch {}

  const match = value.match(/([a-zA-Z0-9_-]{11})/)
  return match?.[1] ?? null
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
    likes?: { count: number }[]
    comments?: { count: number }[]
    reposts?: { count: number }[]
    user_liked?: boolean
    user_reposted?: boolean
  }
  currentUserId?: string
  currentUserRole?: string
}

export default function PostCard({ post, currentUserId, currentUserRole }: PostCardProps) {
  const supabase = createClient()
  const router = useRouter()
  const [liked, setLiked] = useState(post.user_liked || false)
  const [likeCount, setLikeCount] = useState(Number(post.likes?.[0]?.count || 0))
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count || 0)
  const [reposted, setReposted] = useState(post.user_reposted || false)
  const [repostCount, setRepostCount] = useState(post.reposts?.[0]?.count || 0)
  const [showRepostMenu, setShowRepostMenu] = useState(false)
  const [showQuoteModal, setShowQuoteModal] = useState(false)
  const [quoteText, setQuoteText] = useState('')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
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
  const youtubeVideoId = post.youtube_video_id || extractYoutubeId(post.youtube_url)

  const isOwner = currentUserId === post.user_id
  const isAdmin = currentUserRole === 'admin' || currentUserRole === 'moderator'
  const canDelete = isOwner || isAdmin

  const publicUrl = (path: string) =>
    supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl

  const postUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/posts/${post.id}`
    : ''

  useEffect(() => {
    const syncCommentCount = async () => {
      const { count } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', post.id)
        .eq('status', 'active')
      setCommentCount(count || 0)
    }
    void syncCommentCount()
  }, [post.id, supabase])

  const handleLike = async () => {
    if (!currentUserId) return
    if (liked) {
      await supabase.from('likes').delete().eq('user_id', currentUserId).eq('post_id', post.id)
      setLiked(false)
      setLikeCount(prev => Math.max(0, prev - 1))
    } else {
      await supabase.from('likes').insert({ user_id: currentUserId, post_id: post.id })
      setLiked(true)
      setLikeCount(prev => prev + 1)

      if (post.user_id && post.user_id !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: post.user_id,
          actor_id: currentUserId,
          type: 'like',
          target_id: post.id,
          target_type: 'post',
        })
        await sendPushNotification(
          post.user_id,
          'Patiko tavo įrašas',
          post.content.slice(0, 80),
          `/u/${post.profiles?.username}`
        )
      }
    }
  }

  const loadComments = async () => {
    setLoadingComments(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:user_id(username, display_name, avatar_path)')
      .eq('post_id', post.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    const rows = data || []
    setComments(rows)
    setCommentCount(rows.length)
    setLoadingComments(false)
  }

  const toggleComments = async () => {
    if (!showComments) await loadComments()
    setShowComments(!showComments)
  }

  const handleComment = async () => {
    if (!currentUserId || !commentText.trim()) return
    const content = commentText.trim()
    const { data: newComment, error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: currentUserId,
      content
    }).select('id, post_id, user_id, content, created_at, profiles:user_id(username, display_name, avatar_path)').single()
    if (!error) {
      setCommentText('')
      setCommentCount(prev => prev + 1)
      setComments(prev => [...prev, newComment])
      if (!showComments) {
        setShowComments(true)
      }

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
    }
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
    <div className="group p-4 hover:bg-gray-800/20 transition-colors">
      <div className="flex gap-3 sm:gap-4">
        <Link href={`/u/${post.profiles?.username}`} className="flex-shrink-0">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center overflow-hidden relative">
            {post.profiles?.avatar_path ? (
              <Image
                src={publicUrl(post.profiles.avatar_path)}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <span className="text-base sm:text-lg font-bold text-blue-300 dark:text-blue-500">
                {post.profiles?.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          {post.reposted_by_profile && (
            <div className="mb-1 text-xs text-emerald-400">
              <Link href={`/u/${post.reposted_by_profile.username}`} className="hover:underline font-semibold">
                @{post.reposted_by_profile.username}
              </Link>{' '}
              reposted {repostTimeAgo || ''}
            </div>
          )}
          <div className="flex items-center justify-between mb-1 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <Link href={`/u/${post.profiles?.username}`} className="font-bold text-gray-100 hover:underline text-sm sm:text-base truncate max-w-[120px] sm:max-w-[200px]">
                {post.profiles?.display_name}
              </Link>
              <Link href={`/u/${post.profiles?.username}`} className="text-gray-500 text-xs sm:text-sm hover:underline hidden sm:inline truncate max-w-[100px]">
                @{post.profiles?.username}
              </Link>
              <span className="text-gray-500 text-xs sm:text-sm shrink-0">&middot; {timeAgo}</span>
            </div>
            {canDelete && (
              <div className="flex items-center gap-1">
                {isOwner && (
                  <button
                    onClick={() => { setEditedContent(localContent); setShowEditModal(true) }}
                    className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
                    title="Edit post"
                  >
                    <Pencil size={16} />
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors opacity-100 sm:opacity-0 group-hover:opacity-100 min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Delete post"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          <p className="text-gray-100 text-[15px] leading-relaxed whitespace-pre-wrap mb-1">
            <ParsedContent content={localContent} />
          </p>
          {localEditedAt && (
            <p className="text-xs text-gray-500 mb-3">
              edited {formatDistanceToNow(new Date(localEditedAt), { addSuffix: true })}
            </p>
          )}

          {post.quoted_post && post.quoted_post.status !== 'deleted' && (
            <div className="mb-3 rounded-2xl border border-gray-700 p-3 sm:p-4 bg-gray-900/60">
              <div className="flex items-center gap-2 mb-1">
                <Link href={`/u/${post.quoted_post.profiles?.username}`} className="text-sm font-semibold text-gray-200 hover:underline">
                  {post.quoted_post.profiles?.display_name}
                </Link>
                <span className="text-xs text-gray-500">
                  @{post.quoted_post.profiles?.username}
                </span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                <ParsedContent content={post.quoted_post.content} />
              </p>
            </div>
          )}

          {post.post_media && post.post_media.length > 0 && (
            <div className={`grid gap-2 mb-3 rounded-2xl overflow-hidden border border-gray-800 ${post.post_media.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
              {post.post_media.map((m, i) => (
                <div
                  key={i}
                  className="relative w-full h-48 sm:h-64 overflow-hidden cursor-pointer"
                  onClick={() => setLightboxIndex(i)}
                >
                  <Image
                    src={publicUrl(m.storage_path)}
                    alt=""
                    fill
                    sizes={(post.post_media?.length || 0) > 1 ? '(min-width: 640px) 50vw, 100vw' : '100vw'}
                    className="object-cover hover:scale-105 transition-transform"
                    unoptimized
                  />
                </div>
              ))}
            </div>
          )}

          {lightboxIndex !== null && post.post_media && (
            <ImageLightbox
              images={post.post_media.map(m => publicUrl(m.storage_path))}
              initialIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
            />
          )}

          {youtubeVideoId && (
            <div className="mb-3 aspect-video rounded-2xl overflow-hidden border border-gray-800 bg-black">
              <iframe
                width="100%" height="100%"
                src={`https://www.youtube-nocookie.com/embed/${youtubeVideoId}`}
                title="YouTube"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-4 sm:gap-6 mt-3 sm:mt-4 text-gray-500">
            <button onClick={handleLike} className={`flex items-center gap-1.5 sm:gap-2 transition-colors min-h-[44px] ${liked ? 'text-red-500' : 'hover:text-red-600'}`}>
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
              <span className="text-sm">{Number.isFinite(likeCount) ? likeCount : 0}</span>
            </button>
            <button onClick={toggleComments} className="flex items-center gap-1.5 sm:gap-2 hover:text-blue-600 transition-colors min-h-[44px]">
              <MessageCircle size={20} />
              <span className="text-sm">{commentCount}</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setShowRepostMenu(!showRepostMenu)}
                className={`flex items-center gap-1.5 sm:gap-2 transition-colors min-h-[44px] ${reposted ? 'text-emerald-600' : 'hover:text-emerald-600'}`}
              >
                <Repeat2 size={20} />
                <span className="text-sm">{repostCount}</span>
              </button>
              {showRepostMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowRepostMenu(false)} />
                  <div className="absolute bottom-8 left-0 bg-[#101218] rounded-xl shadow-lg border border-gray-700 py-2 w-44 z-50">
                    <button
                      onClick={async () => {
                        await handleRepost()
                        setShowRepostMenu(false)
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-800 transition-colors text-gray-300 min-h-[44px]"
                    >
                      {reposted ? 'Undo repost' : 'Repost'}
                    </button>
                    <button
                      onClick={() => {
                        setShowRepostMenu(false)
                        setShowQuoteModal(true)
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-800 transition-colors text-gray-300 min-h-[44px]"
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
                className="flex items-center gap-2 hover:text-green-600 transition-colors min-h-[44px]"
              >
                <Share2 size={20} />
              </button>
              {showShareMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowShareMenu(false)} />
                  <div className="absolute bottom-8 left-0 sm:left-1/2 sm:-translate-x-1/2 bg-[#101218] rounded-xl shadow-lg border border-gray-700 py-2 w-48 z-50">
                    <button
                      onClick={handleCopyLink}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-800 flex items-center gap-3 transition-colors text-gray-300 min-h-[44px]"
                    >
                      {copied ? <Check size={16} className="text-green-500" /> : <LinkIcon size={16} />}
                      {copied ? 'Copied!' : 'Copy link'}
                    </button>
                    {typeof navigator !== 'undefined' && 'share' in navigator && (
                      <button
                        onClick={handleShareNative}
                        className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-800 flex items-center gap-3 transition-colors text-gray-300 min-h-[44px]"
                      >
                        <Share2 size={16} />
                        Share via...
                      </button>
                    )}
                    <button
                      onClick={shareToTwitter}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-800 flex items-center gap-3 transition-colors text-gray-300 min-h-[44px]"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      Post on X
                    </button>
                    <button
                      onClick={shareToFacebook}
                      className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-800 flex items-center gap-3 transition-colors text-gray-300 min-h-[44px]"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      Share on Facebook
                    </button>
                  </div>
                </>
              )}
            </div>
            {/* Report */}
            {currentUserId && !isOwner && (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 hover:text-yellow-600 transition-colors ml-auto opacity-100 sm:opacity-0 group-hover:opacity-100 min-h-[44px]"
              >
                <AlertCircle size={18} />
              </button>
            )}
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="mt-3 sm:mt-4 space-y-3 border-t border-gray-800 pt-3 sm:pt-4">
              {loadingComments ? (
                <p className="text-sm text-gray-400">Loading comments...</p>
              ) : (
                <>
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-2 sm:gap-3">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden relative">
                        {c.profiles?.avatar_path ? (
                          <Image
                            src={publicUrl(c.profiles.avatar_path)}
                            alt=""
                            fill
                            sizes="32px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <span className="text-xs font-bold text-blue-300 dark:text-blue-500">
                            {c.profiles?.display_name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Link href={`/u/${c.profiles?.username}`} className="font-bold text-xs sm:text-sm text-gray-100 hover:underline">
                            {c.profiles?.display_name}
                          </Link>
                          <span className="text-gray-500 text-xs">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-gray-300 text-xs sm:text-sm whitespace-pre-wrap break-words">
                          <ParsedContent content={c.content} />
                        </p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">Komentarų dar nėra.</p>
                  )}
                </>
              )}

              {currentUserId && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleComment()}
                    placeholder="Parašykite komentarą..."
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-full px-3 sm:px-4 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-500/20 text-gray-200 min-h-[44px]"
                    maxLength={500}
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Quote Modal */}
          {showQuoteModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQuoteModal(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg dark:text-gray-100">Quote Post</h3>
                  <button onClick={() => setShowQuoteModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <X size={20} />
                  </button>
                </div>
                <textarea
                  value={quoteText}
                  onChange={(e) => setQuoteText(e.target.value)}
                  placeholder="Add your comment..."
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-blue-300 resize-none min-h-[110px] bg-white dark:bg-gray-800 dark:text-gray-200"
                  maxLength={2000}
                />
                <div className="mt-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
                    @{post.profiles?.username}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                    <ParsedContent content={post.content} />
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => setShowQuoteModal(false)}
                    className="px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateQuote}
                    disabled={quoteLoading || !quoteText.trim()}
                    className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 min-h-[44px]"
                  >
                    {quoteLoading ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowEditModal(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-lg w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg dark:text-gray-100">Redaguoti įrašą</h3>
                  <button onClick={() => { setShowEditModal(false); setEditError('') }} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <X size={20} />
                  </button>
                </div>
                <textarea
                  value={editedContent}
                  onChange={(e) => { setEditedContent(e.target.value); setEditError('') }}
                  placeholder="Ką galvojate?"
                  className="w-full border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-blue-300 resize-none min-h-[120px] bg-white dark:bg-gray-800 dark:text-gray-200"
                  maxLength={2000}
                  autoFocus
                />
                {editError && (
                  <p className="mt-2 text-sm text-red-500">{editError}</p>
                )}
                <div className="mt-4 flex justify-end gap-3">
                  <button
                    onClick={() => { setShowEditModal(false); setEditError('') }}
                    className="px-4 py-2.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-bold min-h-[44px]"
                  >
                    Atšaukti
                  </button>
                  <button
                    onClick={handleEdit}
                    disabled={editLoading || !editedContent.trim()}
                    className="px-5 py-2.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 min-h-[44px]"
                  >
                    {editLoading ? 'Saugoma...' : 'Išsaugoti'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Confirmation Modal */}
          {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-2 dark:text-gray-100">Ištrinti įrašą?</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 sm:mb-6">Šio veiksmo negalima atšaukti. Įrašas bus pašalintas.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-full font-bold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[44px]"
                  >
                    Atšaukti
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 bg-red-600 text-white py-2.5 rounded-full font-bold hover:bg-red-700 transition-colors min-h-[44px]"
                  >
                    Ištrinti
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Report Modal */}
          {showReportModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowReportModal(false)}>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 sm:p-6 max-w-md w-full shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg dark:text-gray-100">Report Post</h3>
                  <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 min-w-[44px] min-h-[44px] flex items-center justify-center">
                    <X size={20} />
                  </button>
                </div>
                {reportSent ? (
                  <p className="text-green-600 font-bold text-center py-4">Report submitted. Thank you!</p>
                ) : (
                  <>
                    <textarea
                      value={reportReason}
                      onChange={e => setReportReason(e.target.value)}
                      placeholder="Why are you reporting this post?"
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-xl p-3 text-sm outline-none focus:border-red-300 resize-none min-h-[100px] bg-white dark:bg-gray-800 dark:text-gray-200"
                      maxLength={500}
                    />
                    <button
                      onClick={handleReport}
                      disabled={!reportReason.trim()}
                      className="mt-3 w-full bg-red-600 text-white py-2.5 rounded-full font-bold hover:bg-red-700 disabled:opacity-50 transition-colors min-h-[44px]"
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
