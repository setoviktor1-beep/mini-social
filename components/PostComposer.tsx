'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Youtube, Send, X } from 'lucide-react'

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
    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="What's on your mind?"
        className="w-full resize-none outline-none text-lg min-h-[100px]"
      />
      
      {files.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto">
          {files.map((f, i) => (
            <div key={i} className="relative w-20 h-20 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
              <img src={URL.createObjectURL(f)} className="w-full h-full object-cover" />
              <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t pt-3">
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-gray-500 hover:text-blue-600 cursor-pointer transition-colors text-sm">
            <ImageIcon size={18} />
            <span>Photos</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={e => e.target.files && setFiles([...files, ...Array.from(e.target.files)])} />
          </label>
          <div className="flex items-center gap-2 text-gray-500 focus-within:text-red-600 text-sm">
            <Youtube size={18} />
            <input 
              type="text" 
              placeholder="YouTube URL" 
              value={youtube} 
              onChange={e => setYoutube(e.target.value)}
              className="bg-transparent outline-none w-32 border-b border-transparent focus:border-red-200" 
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button 
            onClick={handlePost}
            disabled={loading || (!content && files.length === 0)}
            className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Posting...' : <><Send size={16}/> Post</>}
          </button>
        </div>
      </div>
    </div>
  )
}
