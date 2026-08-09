'use client'
import { useState, useEffect, useMemo, useId, useCallback } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Video, Send, X, Sparkles, Loader2, Check } from 'lucide-react'
import Image from 'next/image'
import { notifyMentions } from '@/lib/mentions'
import { extractYoutubeId, normalizeYoutubeUrl, resolveSupabaseStorageUrl } from '@/lib/media'

const MAX_ATTACHMENTS = 5
const MAX_CONTENT_LENGTH = 2000

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
  const [uploadStep, setUploadStep] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [avatar, setAvatar] = useState<{ path: string | null; displayName: string | null }>({ path: null, displayName: null })
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiSuggestionAction, setAiSuggestionAction] = useState<string | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiTone, setAiTone] = useState('draugišką')
  const [aiLanguage, setAiLanguage] = useState('anglų')
  const fileInputId = useId()
  // UX5: Memoize supabase client to prevent recreation causing re-render loops
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // CB2: Reset composer state when the authenticated user changes
  useEffect(() => {
    setContent('')
    setYoutube('')
    setFiles([])
    setPostError('')
    setLoading(false)
  }, [userId])

  useEffect(() => {
    let active = true
    supabase
      .from('profiles')
      .select('avatar_path, display_name')
      .eq('id', userId)
      .single()
      .then(
        ({ data }: any) => {
          if (active && data) setAvatar({ path: data.avatar_path ?? null, displayName: data.display_name ?? null })
        },
        () => {}
      )
    return () => { active = false }
  }, [userId, supabase])

  const avatarUrl = resolveSupabaseStorageUrl(
    (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
    avatar.path
  )

  const previews = useMemo(
    () => files.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [files]
  )

  const addFiles = useCallback((incoming: File[]) => {
    const images = incoming.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setFiles((prev) => [...prev, ...images].slice(0, MAX_ATTACHMENTS))
  }, [])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)
    addFiles(Array.from(event.dataTransfer.files || []))
  }, [addFiles])

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url))
    }
  }, [previews])

  const handleAiAction = async (action: 'rewrite' | 'tone' | 'translate' | 'spelling' | 'hashtags') => {
    if (!content.trim() || aiLoading) return
    setAiLoading(action)
    setAiError('')
    setAiSuggestion('')
    try {
      const res = await fetch('/api/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, text: content, tone: aiTone, targetLanguage: aiLanguage }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAiError(
          res.status === 503 ? 'AI įrankiai šiuo metu nepasiekiami.'
          : res.status === 429 ? 'Pasiekėte AI naudojimo limitą. Bandykite vėliau.'
          : 'Nepavyko gauti AI pasiūlymo. Bandykite dar kartą.'
        )
        return
      }
      setAiSuggestion(data.suggestion || '')
      setAiSuggestionAction(action)
    } catch {
      setAiError('Nepavyko prisijungti prie AI paslaugos.')
    } finally {
      setAiLoading(null)
    }
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return
    // Only happens on an explicit "Naudoti" click — never automatically.
    if (aiSuggestionAction === 'hashtags') {
      const tags = aiSuggestion.split(/[\s,]+/).filter(Boolean).map((t) => (t.startsWith('#') ? t : `#${t}`))
      setContent((prev) => (prev.trim() ? `${prev.trim()} ${tags.join(' ')}` : tags.join(' ')))
    } else {
      setContent(aiSuggestion)
    }
    setAiSuggestion('')
    setAiSuggestionAction(null)
    setShowAiPanel(false)
  }

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
    setUploadStep('')
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
      let uploadedCount = 0
      for (const file of files) {
        uploadedCount += 1
        setUploadStep(files.length > 1 ? `Įkeliama nuotrauka ${uploadedCount}/${files.length}...` : 'Įkeliama nuotrauka...')
        const uploadFile = file.type.startsWith('image/') ? await compressImage(file) : file
        const dimensions = uploadFile.type.startsWith('image/')
          ? await getImageDimensions(uploadFile)
          : null

        if (dimensions && (dimensions.width < 32 || dimensions.height < 32)) {
          await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
          setPostError('Paveikslėlis per mažas arba neteisingas. Įkelkite normalų paveikslėlį.')
          setLoading(false)
          setUploadStep('')
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
          setUploadStep('')
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
          setUploadStep('')
          return
        }
      }
    }

    setContent('')
    setYoutube('')
    setFiles([])
    setUploadStep('')
    setLoading(false)
    setShowAiPanel(false)
    setAiSuggestion('')
    setAiSuggestionAction(null)
    router.refresh()
  }

  const remainingChars = MAX_CONTENT_LENGTH - content.length
  const nearLimit = remainingChars <= 100
  const canAddMore = files.length < MAX_ATTACHMENTS

  return (
    <div className="border-b border-slate-100 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4">
      <input
        id={fileInputId}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={!canAddMore}
        onChange={(e) => {
          if (!e.target.files) return
          addFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />

      <div className="flex gap-3">
        <div className="hidden sm:flex w-10 h-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-blue-50 ring-2 ring-white shadow-sm">
          {avatar.path && avatarUrl ? (
            <Image src={avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-sm font-bold text-blue-600">{avatar.displayName?.charAt(0)?.toUpperCase() || '?'}</span>
          )}
        </div>

        <div
          className={`flex-1 min-w-0 rounded-2xl border transition-colors ${
            isDragActive ? 'border-dashed border-blue-400 bg-blue-50/50' : 'border-transparent'
          }`}
          onDragOver={(e) => { e.preventDefault(); if (canAddMore) setIsDragActive(true) }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
        >
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.slice(0, MAX_CONTENT_LENGTH))}
            placeholder="Ką galvojate?"
            maxLength={MAX_CONTENT_LENGTH}
            className="w-full min-h-[86px] resize-none bg-transparent text-base sm:text-lg text-slate-800 placeholder-slate-400 outline-none px-1"
          />

          {files.length > 0 && (
            <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto -mx-1 px-1">
              {previews.map(({ file, url }, i) => (
                <div key={i} className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 shadow-sm">
                  <Image src={url} alt="" fill sizes="80px" className="object-cover pointer-events-none" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    aria-label={`Pašalinti nuotrauką ${i + 1}`}
                    className="absolute top-1 right-1 z-10 bg-black/50 text-white rounded-full p-0.5 min-w-[24px] min-h-[24px] flex items-center justify-center hover:bg-black/70 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 pt-3">
        {postError && (
        <p className="text-sm text-red-500 mb-2 bg-red-50 px-3 py-2 rounded-lg" role="alert">{postError}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <label
            htmlFor={fileInputId}
            className={`flex w-fit min-h-[44px] items-center gap-2 text-sm px-2 rounded-lg transition-colors ${
              canAddMore
                ? 'cursor-pointer text-blue-600 hover:text-blue-700 hover:bg-blue-50'
                : 'cursor-not-allowed text-slate-300'
            }`}
          >
            <ImageIcon size={18} />
            <span>Nuotraukos{files.length > 0 ? ` (${files.length}/${MAX_ATTACHMENTS})` : ''}</span>
          </label>
          <div className="flex min-h-[44px] items-center gap-2 text-sm text-purple-600 focus-within:text-purple-700 hover:bg-purple-50 px-2 rounded-lg transition-colors">
            <Video size={18} className="flex-shrink-0" />
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
              className="min-h-[44px] w-full border-b border-transparent bg-transparent text-slate-700 outline-none focus:border-purple-400 sm:w-40"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowAiPanel((v) => !v)}
            disabled={!content.trim()}
            aria-expanded={showAiPanel}
            className="flex min-h-[44px] items-center gap-2 text-sm px-2 rounded-lg transition-colors text-violet-600 hover:text-violet-700 hover:bg-violet-50 disabled:text-slate-300 disabled:cursor-not-allowed"
          >
            <Sparkles size={18} />
            <span>AI pagalba</span>
          </button>
        </div>

        {showAiPanel && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleAiAction('rewrite')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'rewrite' ? <Loader2 size={14} className="animate-spin" /> : null} Perrašyti
              </button>
              <button type="button" onClick={() => handleAiAction('spelling')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'spelling' ? <Loader2 size={14} className="animate-spin" /> : null} Taisyti rašybą
              </button>
              <button type="button" onClick={() => handleAiAction('hashtags')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'hashtags' ? <Loader2 size={14} className="animate-spin" /> : null} #Hashtag&apos;ai
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} className="min-h-[36px] rounded-full border border-violet-200 bg-white px-2 text-sm text-violet-700">
                <option value="draugišką">draugišką</option>
                <option value="formalų">formalų</option>
                <option value="glaustą">glaustą</option>
                <option value="entuziastingą">entuziastingą</option>
              </select>
              <button type="button" onClick={() => handleAiAction('tone')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'tone' ? <Loader2 size={14} className="animate-spin" /> : null} Keisti toną
              </button>
              <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} className="min-h-[36px] rounded-full border border-violet-200 bg-white px-2 text-sm text-violet-700">
                <option value="anglų">į anglų</option>
                <option value="lietuvių">į lietuvių</option>
                <option value="rusų">į rusų</option>
                <option value="lenkų">į lenkų</option>
              </select>
              <button type="button" onClick={() => handleAiAction('translate')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'translate' ? <Loader2 size={14} className="animate-spin" /> : null} Versti
              </button>
            </div>

            {aiError && (
              <p role="alert" className="text-sm text-red-600">{aiError}</p>
            )}

            {aiSuggestion && (
              <div className="rounded-xl border border-violet-200 bg-white p-3 space-y-2">
                <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide">AI pasiūlymas — peržiūrėkite prieš naudodami</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{aiSuggestion}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyAiSuggestion}
                    className="min-h-[36px] px-4 rounded-full bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 flex items-center gap-1.5"
                  >
                    <Check size={14} /> Naudoti
                  </button>
                  <button type="button" onClick={() => { setAiSuggestion(''); setAiSuggestionAction(null) }} className="min-h-[36px] px-4 rounded-full border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">
                    Atmesti
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-slate-400">
          Enter palieka naują eilutę. YouTube nuorodą galite dėti į atskirą lauką arba vieną pačią į posto tekstą. Nuotraukas taip pat galite tempti ir paleisti čia.
        </p>
        <div className="flex justify-between items-center">
          <span className={`text-xs ${nearLimit ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
            {remainingChars}
          </span>
          <button
            type="button"
            onClick={handlePost}
            disabled={loading}
            className="min-h-[44px] rounded-full bg-gradient-to-r from-[#1A1A2E] to-[#16213E] px-6 py-2 font-semibold text-white hover:shadow-lg hover:shadow-slate-900/20 disabled:opacity-50 flex items-center gap-2 transition-all hover:-translate-y-0.5"
          >
            {loading ? (uploadStep || 'Skelbiama...') : <><Send size={16}/> Skelbti</>}
          </button>
        </div>
      </div>
    </div>
  )
}
