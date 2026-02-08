'use client'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart, MessageCircle, AlertCircle, Send, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface PostCardProps {
  post: {
    id: string
    content: string
    created_at: string
    youtube_video_id?: string
    profiles?: { username: string; display_name: string; avatar_path?: string }
    post_media?: { storage_path: string }[]
    likes?: { count: number }[]
    comments?: { count: number }[]
    user_liked?: boolean
  }
  currentUserId?: string
}

export default function PostCard({ post, currentUserId }: PostCardProps) {
  const supabase = createClient()
  const router = useRouter()
  const [liked, setLiked] = useState(post.user_liked || false)
  const [likeCount, setLikeCount] = useState(post.likes?.[0]?.count || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<any[]>([])
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(post.comments?.[0]?.count || 0)
  const [loadingComments, setLoadingComments] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)

  const publicUrl = (path: string) =>
    supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl

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
    }
  }

  const loadComments = async () => {
    setLoadingComments(true)
    const { data } = await supabase
      .from('comments')
      .select('*, profiles:user_id(username, display_name)')
      .eq('post_id', post.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoadingComments(false)
  }

  const toggleComments = async () => {
    if (!showComments) {
      await loadComments()
    }
    setShowComments(!showComments)
  }

  const handleComment = async () => {
    if (!currentUserId || !commentText.trim()) return
    const { error } = await supabase.from('comments').insert({
      post_id: post.id,
      user_id: currentUserId,
      content: commentText.trim()
    })
    if (!error) {
      setCommentText('')
      setCommentCount(prev => prev + 1)
      await loadComments()
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

  const timeAgo = formatDistanceToNow(new Date(post.created_at), { addSuffix: true })

  return (
    <div className="p-5 hover:bg-gray-50/50 transition-colors group">
      <div className="flex gap-4">
        <Link href={`/u/${post.profiles?.username}`} className="flex-shrink-0">
          <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center overflow-hidden">
            {post.profiles?.avatar_path ? (
              <img src={publicUrl(post.profiles.avatar_path)} className="w-full h-full object-cover" alt="" />
            ) : (
              <span className="text-lg font-bold text-blue-300">
                {post.profiles?.display_name?.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 truncate">
              <Link href={`/u/${post.profiles?.username}`} className="font-bold text-gray-900 hover:underline">
                {post.profiles?.display_name}
              </Link>
              <Link href={`/u/${post.profiles?.username}`} className="text-gray-500 text-sm hover:underline">
                @{post.profiles?.username}
              </Link>
              <span className="text-gray-400 text-sm">· {timeAgo}</span>
            </div>
          </div>

          <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>

          {post.post_media && post.post_media.length > 0 && (
            <div className={`grid gap-2 mb-3 rounded-2xl overflow-hidden border border-gray-100 ${post.post_media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {post.post_media.map((m, i) => (
                <img key={i} src={publicUrl(m.storage_path)} className="w-full h-64 object-cover hover:scale-105 transition-transform cursor-pointer" alt="" />
              ))}
            </div>
          )}

          {post.youtube_video_id && (
            <div className="mb-3 aspect-video rounded-2xl overflow-hidden border border-gray-100 bg-black">
              <iframe
                width="100%" height="100%"
                src={`https://www.youtube-nocookie.com/embed/${post.youtube_video_id}`}
                title="YouTube" frameBorder="0" allowFullScreen
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-8 mt-4 text-gray-500">
            <button onClick={handleLike} className={`flex items-center gap-2 transition-colors ${liked ? 'text-red-500' : 'hover:text-red-600'}`}>
              <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
              <span className="text-sm">{likeCount}</span>
            </button>
            <button onClick={toggleComments} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
              <MessageCircle size={20} />
              <span className="text-sm">{commentCount}</span>
            </button>
            {currentUserId && (
              <button
                onClick={() => setShowReportModal(true)}
                className="flex items-center gap-2 hover:text-yellow-600 transition-colors ml-auto opacity-0 group-hover:opacity-100"
              >
                <AlertCircle size={18} />
              </button>
            )}
          </div>

          {/* Comments section */}
          {showComments && (
            <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
              {loadingComments ? (
                <p className="text-sm text-gray-400">Loading comments...</p>
              ) : (
                <>
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs font-bold text-blue-300">
                          {c.profiles?.display_name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/u/${c.profiles?.username}`} className="font-bold text-sm text-gray-900 hover:underline">
                            {c.profiles?.display_name}
                          </Link>
                          <span className="text-gray-400 text-xs">
                            {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  {comments.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">No comments yet.</p>
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
                    placeholder="Write a comment..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-sm outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-100"
                    maxLength={500}
                  />
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim()}
                    className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Report Modal */}
          {showReportModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowReportModal(false)}>
              <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg">Report Post</h3>
                  <button onClick={() => setShowReportModal(false)} className="text-gray-400 hover:text-gray-600">
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
                      className="w-full border border-gray-200 rounded-xl p-3 text-sm outline-none focus:border-red-300 resize-none min-h-[100px]"
                      maxLength={500}
                    />
                    <button
                      onClick={handleReport}
                      disabled={!reportReason.trim()}
                      className="mt-3 w-full bg-red-600 text-white py-2 rounded-full font-bold hover:bg-red-700 disabled:opacity-50 transition-colors"
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
