'use client'
import { createClient } from '@/lib/supabase'
import Link from 'next/link'
import { Heart, MessageCircle, AlertCircle } from 'lucide-react'

export default function PostCard({ post, currentUserId }: { post: any, currentUserId?: string }) {
  const supabase = createClient()
  const publicUrl = (path: string) => 
    supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl

  const handleLike = async () => {
    if (!currentUserId) return
    // Simple toggle logic for MVP
    await supabase.from('likes').upsert({ user_id: currentUserId, post_id: post.id })
  }

  return (
    <div className="p-5 hover:bg-gray-50/50 transition-colors group">
      <div className="flex gap-4">
        <div className="w-12 h-12 bg-gray-100 rounded-full flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-gray-900">{post.profiles?.display_name}</span>
              <span className="text-gray-500 text-sm">@{post.profiles?.username}</span>
              <span className="text-gray-400 text-sm">• {new Date(post.created_at).toLocaleDateString()}</span>
            </div>
          </div>
          
          <p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>

          {post.post_media?.length > 0 && (
            <div className={`grid gap-2 mb-3 rounded-2xl overflow-hidden border border-gray-100 ${post.post_media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {post.post_media.map((m: any, i: number) => (
                <img key={i} src={publicUrl(m.storage_path)} className="w-full h-64 object-cover hover:scale-105 transition-transform cursor-pointer" />
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

          <div className="flex items-center gap-8 mt-4 text-gray-500">
            <button onClick={handleLike} className="flex items-center gap-2 hover:text-red-600 transition-colors">
              <Heart size={20} />
              <span className="text-sm">{post.likes?.[0]?.count || 0}</span>
            </button>
            <Link href={`/post/${post.id}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
              <MessageCircle size={20} />
              <span className="text-sm">Reply</span>
            </Link>
            <button className="flex items-center gap-2 hover:text-yellow-600 transition-colors ml-auto opacity-0 group-hover:opacity-100">
              <AlertCircle size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
