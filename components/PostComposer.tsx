'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Youtube, Send, X } from 'lucide-react'
import Image from 'next/image'
import { notifyMentions } from '@/lib/mentions'
import { extractYoutubeId, normalizeYoutubeUrl } from '@/lib/media'

async function compressImage(file: File): Promise<File> {
  const MAX_SIZE = 1200
  const QUALITY = 0.85

  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      let { width, height } = img
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width)
          width = MAX_SIZE
        } else {
          width = Math.round((width * MAX_SIZE) / height)
          height = MAX_SIZE
        }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(file); return }
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return }
          const baseName = file.name.replace(/\.[^.]+$/, '')
          resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        QUALITY
      )
    }
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Failed to load image')) }
    img.src = objectUrl
  })
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    const objectUrl = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve({ width: img.width, height: img.height })
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to read image dimensions'))
    }
    img.src = objectUrl
  })
}

export default function PostComposer({ userId }: { userId: string }) {
  const [content, setContent] = useState('')
  const [youtube, setYoutube] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [postError, setPostError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  const handlePost = async () => {
    if (loading) return
    const trimmedContent = content.trim()
    const typedYoutube = youtube.trim()
    const contentYoutubeId = typedYoutube ? null : extractYoutubeId(trimmedContent)
    const youtubeId = extractYoutubeId(typedYoutube) || contentYoutubeId
    const normalizedYoutubeUrl = normalizeYoutubeUrl(typedYoutube || trimmedContent)
    const contentIsOnlyYoutubeUrl = !!contentYoutubeId && trimmedContent.length > 0
    const finalContent = contentIsOnlyYoutubeUrl ? '' : trimmedContent

    if (!finalContent && files.length === 0 && !youtubeId) {
      setPostError('Parašykite ką nors arba pridėkite nuotrauką.')
      return
    }
    setPostError('')
    setLoading(true)

    if ((typedYoutube || contentYoutubeId) && !youtubeId) {
      setPostError('Neteisinga YouTube nuoroda.')
      setLoading(false)
      return
    }

    const { data: post, error } = await supabase.from('posts').insert({
      user_id: userId,
      content: finalContent,
      youtube_url: normalizedYoutubeUrl,
      youtube_video_id: youtubeId,
    }).select().single()

    if (error) {
      setPostError('Nepavyko paskelbti. Bandykite dar kartą.')
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

    await notifyMentions({
      supabase,
      content: finalContent,
      actorId: userId,
      targetId: post.id,
      targetType: 'post',
      excludeUserIds: followerIds,
    })

    if (files.length > 0) {
      for (const file of files) {
        const uploadFile = file.type.startsWith('image/') ? await compressImage(file) : file
        const dimensions = uploadFile.type.startsWith('image/')
          ? await getImageDimensions(uploadFile)
          : null

        if (dimensions && (dimensions.width < 32 || dimensions.height < 32)) {
          await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
          setPostError('Paveikslėlis per mažas arba neteisingas. Įkelkite normalų paveikslėlį.')
          setLoading(false)
          return
        }

        const path = `${userId}/${Date.now()}_${uploadFile.name}`
        const { error: uploadError } = await supabase.storage.from('post-images').upload(path, uploadFile, {
          contentType: uploadFile.type,
        })

        if (uploadError) {
          await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
          setPostError('Nepavyko įkelti nuotraukos. Bandykite dar kartą.')
          setLoading(false)
          return
        }

        const { error: mediaError } = await supabase.from('post_media').insert({
          post_id: post.id,
          user_id: userId,
          storage_path: path
        })

        if (mediaError) {
          await supabase.storage.from('post-images').remove([path])
          await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
          setPostError('Nepavyko susieti nuotraukos su įrašu. Bandykite dar kartą.')
          setLoading(false)
          return
        }
      }
    }

    setContent('')
    setYoutube('')
    setFiles([])
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="border-b border-gray-800/60 bg-transparent p-4">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Ką galvojate?"
        className="w-full min-h-[86px] resize-none bg-transparent text-base sm:text-lg text-gray-100 placeholder-gray-500 outline-none"
      />

      {files.length > 0 && (
        <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto -mx-1 px-1">
          {files.map((f, i) => (
            <div key={i} className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden flex-shrink-0 border border-gray-700">
              <Image src={URL.createObjectURL(f)} alt="" fill sizes="80px" className="object-cover" unoptimized />
              <button onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 min-w-[24px] min-h-[24px] flex items-center justify-center">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-gray-800/60 pt-3">
        {postError && (
        <p className="text-sm text-red-400 mb-2">{postError}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
            <ImageIcon size={18} />
            <span>Nuotraukos</span>
            <input type="file" multiple accept="image/*" className="hidden" onChange={e => e.target.files && setFiles([...files, ...Array.from(e.target.files)])} />
          </label>
          <div className="flex min-h-[44px] items-center gap-2 text-sm text-purple-400 focus-within:text-purple-300">
            <Youtube size={18} className="flex-shrink-0" />
            <input
              type="url"
              placeholder="YouTube URL"
              value={youtube}
              onChange={e => setYoutube(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                }
              }}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="min-h-[44px] w-full border-b border-transparent bg-transparent text-gray-200 outline-none focus:border-purple-300 sm:w-40"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Enter palieka naują eilutę. YouTube nuorodą galite dėti į atskirą lauką arba vieną pačią į posto tekstą.
        </p>
        <div className="flex justify-end">
          <button
            onClick={handlePost}
            disabled={loading || (!content.trim() && files.length === 0 && !youtube.trim() && !extractYoutubeId(content.trim()))}
            className="min-h-[44px] rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? 'Skelbiama...' : <><Send size={16}/> Skelbti</>}
          </button>
        </div>
      </div>
    </div>
  )
}
