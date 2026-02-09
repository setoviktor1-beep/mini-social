'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Youtube, Send, X } from 'lucide-react'
import Image from 'next/image'

export default function PostComposer({ userId }: { userId: string }) {
  const [content, setContent] = useState('')
  const [youtube, setYoutube] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const extractYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = url.match(regExp)
    return (match && match[2].length === 11) ? match[2] : null
  }

  const handlePost = async () => {
    if (!content && files.length === 0) return
    setLoading(true)

    const ytId = youtube ? extractYoutubeId(youtube) : null

    const { data: post, error } = await supabase.from('posts').insert({
      user_id: userId,
      content,
      youtube_url: youtube || null,
      youtube_video_id: ytId
    }).select().single()

    if (error) {
      alert(error.message)
      setLoading(false)
      return
    }

    // Notify followers about a new post
    const { data: followerRows } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId)

    const followerIds = (followerRows || []).map((r: any) => r.follower_id).filter(Boolean)
    if (followerIds.length > 0) {
      await supabase.from('notifications').insert(
        followerIds.map((fid: string) => ({
          user_id: fid,
          actor_id: userId,
          type: 'new_post',
          target_id: post.id,
          target_type: 'post',
        }))
      )
    }

    if (files.length > 0) {
      for (const file of files) {
        const path = `${userId}/${Date.now()}_${file.name}`
        await supabase.storage.from('post-images').upload(path, file)
        await supabase.from('post_media').insert({
          post_id: post.id,
          user_id: userId,
          storage_path: path
        })
      }
    }

    setContent('')
    setYoutube('')
    setFiles([])
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What's on your mind?"
        className="w-full resize-none outline-none text-base sm:text-lg min-h-[80px] sm:min-h-[100px] bg-transparent dark:text-gray-200 dark:placeholder-gray-500"
      />

      {files.length > 0 && (
        <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto -mx-1 px-1">
          {files.map((f, i) => (
            <div key={i} className="relative w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
              <Image src={URL.createObjectURL(f)} alt="" fill sizes="80px" className="object-cover" unoptimized />
              <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 min-w-[24px] min-h-[24px] flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t dark:border-gray-800 pt-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <label className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-blue-600 cursor-pointer transition-colors text-sm min-h-[44px]">
            <ImageIcon size={18} />
            <span>Photos</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={e => e.target.files && setFiles([...files, ...Array.from(e.target.files)])} />
          </label>
          <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 focus-within:text-red-600 text-sm min-h-[44px]">
            <Youtube size={18} className="flex-shrink-0" />
            <input
              type="text"
              placeholder="YouTube URL"
              value={youtube}
              onChange={e => setYoutube(e.target.value)}
              className="bg-transparent outline-none w-full sm:w-32 border-b border-transparent focus:border-red-200 dark:text-gray-300 min-h-[44px]"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={loading || (!content && files.length === 0)}
            className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 min-h-[44px]"
          >
            {loading ? 'Posting...' : <><Send size={16}/> Post</>}
          </button>
        </div>
      </div>
    </div>
  )
}
