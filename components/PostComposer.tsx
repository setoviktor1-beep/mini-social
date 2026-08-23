'use client'

import { useState, useEffect, useMemo, useId, useCallback, useRef } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'
import { Send, X, Sparkles, Loader2, Check, Link as LinkIcon, Video as VideoIcon } from 'lucide-react'
import Image from 'next/image'
import { notifyMentions, detectMentionTrigger, type MentionTrigger } from '@/lib/mentions'
import { extractYoutubeId, normalizeYoutubeUrl, resolveSupabaseStorageUrl, extractFirstPreviewableUrl } from '@/lib/media'
import { useI18n } from '@/lib/i18n'
import AttachmentMenu from '@/components/composer/AttachmentMenu'
import AIComposerMenu, { type ComposerAiAction } from '@/components/ai/AIComposerMenu'

interface MentionSuggestion {
  id: string
  username: string
  displayName: string
  avatarPath: string | null
}

const MAX_ATTACHMENTS = 5
const MAX_CONTENT_LENGTH = 2000
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm'])
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB
const MAX_VIDEO_DURATION_SECONDS = 120

async function readVideoDurationSeconds(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const videoEl = document.createElement('video')
    const objectUrl = URL.createObjectURL(file)
    const cleanup = () => URL.revokeObjectURL(objectUrl)
    videoEl.preload = 'metadata'
    videoEl.onloadedmetadata = () => {
      cleanup()
      resolve(Number.isFinite(videoEl.duration) ? videoEl.duration : null)
    }
    videoEl.onerror = () => {
      cleanup()
      resolve(null)
    }
    videoEl.src = objectUrl
  })
}

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
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [youtube, setYoutube] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoError, setVideoError] = useState('')
  const [linkPreview, setLinkPreview] = useState<{ url: string; title: string | null; description: string | null; image: string | null } | null>(null)
  const [linkPreviewLoading, setLinkPreviewLoading] = useState(false)
  const [linkPreviewError, setLinkPreviewError] = useState(false)
  const [dismissedPreviewUrl, setDismissedPreviewUrl] = useState<string | null>(null)
  const [mentionTrigger, setMentionTrigger] = useState<MentionTrigger | null>(null)
  const [mentionResults, setMentionResults] = useState<MentionSuggestion[]>([])
  const [mentionLoading, setMentionLoading] = useState(false)
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0)
  const [mentionDismissed, setMentionDismissed] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const mentionAbortRef = useRef<AbortController | null>(null)
  const mentionListboxId = useId()
  const [loading, setLoading] = useState(false)
  const [postError, setPostError] = useState('')
  const [uploadStep, setUploadStep] = useState('')
  const [isDragActive, setIsDragActive] = useState(false)
  const [avatar, setAvatar] = useState<{ path: string | null; displayName: string | null }>({ path: null, displayName: null })
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiSuggestionAction, setAiSuggestionAction] = useState<string | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiAssistedApplied, setAiAssistedApplied] = useState(false)
  const fileInputId = useId()
  const videoInputId = useId()
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  useEffect(() => {
    setContent('')
    setYoutube('')
    setFiles([])
    setVideoFile(null)
    setVideoError('')
    setLinkPreview(null)
    setLinkPreviewError(false)
    setDismissedPreviewUrl(null)
    setMentionTrigger(null)
    setMentionResults([])
    setMentionDismissed(false)
    setPostError('')
    setLoading(false)
    setAiAssistedApplied(false)
    setAiSuggestion('')
    setAiSuggestionAction(null)
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
  const videoPreviewUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : null),
    [videoFile]
  )
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl)
    }
  }, [videoPreviewUrl])

  const addFiles = useCallback(
    (newFiles: File[]) => {
      setPostError('')
      const imageFiles = newFiles.filter((f) => f.type.startsWith('image/'))
      if (imageFiles.length === 0) return
      if (videoFile) {
        setPostError(t('composer.noMixedMedia', 'Įraše gali būti tik nuotraukos arba vienas vaizdo įrašas, ne abu.'))
        return
      }
      setFiles((prev) => {
        const combined = [...prev, ...imageFiles]
        if (combined.length > MAX_ATTACHMENTS) {
          setPostError(t('composer.maxImages', `Daugiausiai galima pridėti ${MAX_ATTACHMENTS} nuotraukas.`))
          return combined.slice(0, MAX_ATTACHMENTS)
        }
        return combined
      })
    },
    [videoFile, t]
  )

  const addVideo = useCallback(
    async (file: File | undefined) => {
      setPostError('')
      setVideoError('')
      if (!file) return

      if (files.length > 0) {
        setPostError(t('composer.noMixedMedia', 'Įraše gali būti tik nuotraukos arba vienas vaizdo įrašas, ne abu.'))
        return
      }

      if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
        setVideoError('Palaikomi tik MP4 ir WebM vaizdo įrašai.')
        return
      }

      if (file.size > MAX_VIDEO_BYTES) {
        setVideoError('Vaizdo įrašas per didelis (maks. 50MB).')
        return
      }

      const duration = await readVideoDurationSeconds(file)
      if (duration !== null && duration > MAX_VIDEO_DURATION_SECONDS) {
        setVideoError('Vaizdo įrašas per ilgas (maks. 2 min.).')
        return
      }

      setVideoFile(file)
    },
    [files.length, t]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragActive(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length === 0) return

      const video = droppedFiles.find((f) => ALLOWED_VIDEO_TYPES.has(f.type) || f.type.startsWith('video/'))
      if (video) {
        void addVideo(video)
        return
      }

      addFiles(droppedFiles)
    },
    [addFiles, addVideo]
  )

  const updateMentionState = useCallback((text: string, cursor: number) => {
    const trigger = detectMentionTrigger(text, cursor)
    setMentionTrigger(trigger)
    setMentionDismissed(false)
  }, [])

  const selectMention = (user: MentionSuggestion) => {
    if (!mentionTrigger) return
    const before = content.slice(0, mentionTrigger.start)
    const after = content.slice(mentionTrigger.end)
    const insertion = `@${user.username} `
    const nextContent = `${before}${insertion}${after}`.slice(0, MAX_CONTENT_LENGTH)
    setContent(nextContent)
    setMentionTrigger(null)
    setMentionResults([])
    const cursorPos = before.length + insertion.length
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(cursorPos, cursorPos)
    })
  }

  // Debounced mention search
  useEffect(() => {
    mentionAbortRef.current?.abort()
    if (!mentionTrigger || mentionTrigger.query.length === 0 || mentionDismissed) {
      setMentionResults([])
      setMentionLoading(false)
      return
    }

    setMentionLoading(true)
    const controller = new AbortController()
    mentionAbortRef.current = controller
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/mentions/search?q=${encodeURIComponent(mentionTrigger.query)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setMentionResults([])
          return
        }
        const data = await res.json()
        setMentionResults(data.results || [])
        setMentionActiveIndex(0)
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') setMentionResults([])
      } finally {
        if (!controller.signal.aborted) setMentionLoading(false)
      }
    }, 250)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [mentionTrigger, mentionDismissed])

  // Link preview debouncing
  useEffect(() => {
    const firstUrl = extractFirstPreviewableUrl(content)
    if (!firstUrl) {
      setLinkPreview(null)
      setLinkPreviewLoading(false)
      setLinkPreviewError(false)
      setDismissedPreviewUrl(null)
      return
    }

    if (dismissedPreviewUrl === firstUrl) return
    if (linkPreview?.url === firstUrl) return

    const controller = new AbortController()
    setLinkPreviewLoading(true)
    setLinkPreviewError(false)

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/link-preview?url=${encodeURIComponent(firstUrl)}`, {
          signal: controller.signal,
        })
        if (!res.ok) {
          setLinkPreview(null)
          setLinkPreviewError(true)
          return
        }
        const data = await res.json()
        setLinkPreview(data)
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          setLinkPreview(null)
          setLinkPreviewError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLinkPreviewLoading(false)
        }
      }
    }, 500)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [content, dismissedPreviewUrl, linkPreview?.url])

  const removeLinkPreview = () => {
    if (linkPreview) setDismissedPreviewUrl(linkPreview.url)
    setLinkPreview(null)
    setLinkPreviewError(false)
  }

  const handleAiAction = async (
    action: ComposerAiAction,
    extra?: { tone?: string; targetLanguage?: string }
  ) => {
    if (!content.trim() || aiLoading) return
    setAiLoading(action)
    setAiError('')
    setAiSuggestion('')
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch('/api/ai/compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          text: content,
          tone: extra?.tone || 'draugišką',
          targetLanguage: extra?.targetLanguage || 'anglų',
        }),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = data?.error
        setAiError(
          code === 'AI_UNAVAILABLE'
            ? 'AI paslauga šiuo metu nepasiekiama. Pabandykite vėliau.'
            : code === 'QUOTA_EXCEEDED'
              ? data?.message || 'Pasiekėte mėnesinę AI naudojimo ribą.'
              : code === 'RATE_LIMITED'
                ? 'Per daug AI užklausų. Palaukite ir bandykite dar kartą.'
                : code === 'TEXT_TOO_LONG'
                  ? 'Tekstas per ilgas AI apdorojimui.'
                  : 'Nepavyko gauti AI pasiūlymo. Bandykite dar kartą.'
        )
        return
      }
      setAiSuggestion(data.suggestion || '')
      setAiSuggestionAction(action)
    } catch (err) {
      setAiError(
        (err as Error)?.name === 'AbortError'
          ? 'AI užklausa užtruko per ilgai ir buvo nutraukta.'
          : 'Nepavyko prisijungti prie AI paslaugos.'
      )
    } finally {
      clearTimeout(timeout)
      setAiLoading(null)
    }
  }

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return
    if (aiSuggestionAction === 'hashtags') {
      const tags = aiSuggestion
        .split(/[\s,]+/)
        .filter(Boolean)
        .map((t) => (t.startsWith('#') ? t : `#${t}`))
      setContent((prev) => (prev.trim() ? `${prev.trim()} ${tags.join(' ')}` : tags.join(' ')))
    } else {
      setContent(aiSuggestion)
    }
    setAiAssistedApplied(true)
    setAiSuggestion('')
    setAiSuggestionAction(null)
  }

  const handlePost = async () => {
    if (loading) return
    const trimmedContent = content.trim()
    const typedYoutube = youtube.trim()
    const contentYoutubeId = typedYoutube ? null : extractYoutubeId(trimmedContent)
    const youtubeId = extractYoutubeId(typedYoutube) || contentYoutubeId
    const normalizedYoutubeUrl = normalizeYoutubeUrl(typedYoutube || trimmedContent)
    const contentIsOnlyYoutubeUrl = Boolean(contentYoutubeId && trimmedContent.length > 0)
    const finalContent = contentIsOnlyYoutubeUrl ? '' : trimmedContent

    if (!finalContent && files.length === 0 && !videoFile && !youtubeId) {
      setPostError(t('composer.emptyError', 'Parašykite ką nors arba pridėkite mediją.'))
      return
    }
    setPostError('')
    setUploadStep('')
    setLoading(true)

    if ((typedYoutube || contentYoutubeId) && !youtubeId) {
      setPostError(t('composer.invalidYoutube', 'Neteisinga YouTube nuoroda.'))
      setLoading(false)
      return
    }

    const activePreview =
      linkPreview && extractFirstPreviewableUrl(finalContent) === linkPreview.url ? linkPreview : null

    const { data: post, error } = await supabase
      .from('posts')
      .insert({
        user_id: userId,
        content: finalContent,
        youtube_url: youtubeId ? normalizedYoutubeUrl : null,
        youtube_video_id: youtubeId,
        link_preview_url: activePreview?.url ?? null,
        link_preview_title: activePreview?.title ?? null,
        link_preview_description: activePreview?.description ?? null,
        link_preview_image: activePreview?.image ?? null,
      })
      .select('id')
      .single()

    if (error || !post) {
      setPostError(t('composer.failed', 'Nepavyko sukurti įrašo. Bandykite dar kartą.'))
      setLoading(false)
      return
    }

    void notifyMentions({
      content: finalContent,
      actorId: userId,
      targetId: post.id,
      targetType: 'post',
      supabase,
    })

    if (files.length > 0) {
      setUploadStep(t('composer.uploadingImages', 'Įkeliamos nuotraukos...'))
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const uploadFile =
          file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp'
            ? await compressImage(file)
            : file

        const dimensions =
          uploadFile.type === 'image/jpeg' || uploadFile.type === 'image/png'
            ? await getImageDimensions(uploadFile)
            : null

        if (dimensions && (dimensions.width < 32 || dimensions.height < 32)) {
          await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
          setPostError('Paveikslėlis per mažas arba neteisingas.')
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
          storage_path: path,
        })

        if (mediaError) {
          await supabase.storage.from('post-images').remove([path])
          await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
          setPostError('Nepavyko susieti nuotraukos su įrašu.')
          setLoading(false)
          setUploadStep('')
          return
        }
      }
    }

    if (videoFile) {
      setUploadStep(t('composer.uploadingVideo', 'Įkeliamas vaizdo įrašas...'))
      const path = `${userId}/${Date.now()}_${videoFile.name}`
      const { error: uploadError } = await supabase.storage.from('post-images').upload(path, videoFile, {
        contentType: videoFile.type,
      })

      if (uploadError) {
        await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
        setPostError('Nepavyko įkelti vaizdo įrašo. Bandykite dar kartą.')
        setLoading(false)
        setUploadStep('')
        return
      }

      const { error: mediaError } = await supabase.from('post_media').insert({
        post_id: post.id,
        user_id: userId,
        storage_path: path,
        media_type: 'video',
      })

      if (mediaError) {
        await supabase.storage.from('post-images').remove([path])
        await supabase.from('posts').delete().eq('id', post.id).eq('user_id', userId)
        setPostError('Nepavyko susieti vaizdo įrašo.')
        setLoading(false)
        setUploadStep('')
        return
      }
    }

    setContent('')
    setYoutube('')
    setVideoFile(null)
    setVideoError('')
    setLinkPreview(null)
    setLinkPreviewError(false)
    setDismissedPreviewUrl(null)
    setMentionTrigger(null)
    setMentionResults([])
    setMentionDismissed(false)
    setFiles([])
    setUploadStep('')
    setLoading(false)
    setAiSuggestion('')
    setAiSuggestionAction(null)
    setAiAssistedApplied(false)
    router.refresh()
  }

  const remainingChars = MAX_CONTENT_LENGTH - content.length
  const nearLimit = remainingChars <= 100
  const canAddMore = files.length < MAX_ATTACHMENTS

  return (
    <div className="border-b border-slate-100 bg-white p-4 transition-colors dark:border-gray-800 dark:bg-gray-900">
      {/* Hidden system file inputs */}
      <input
        id={fileInputId}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        disabled={!canAddMore || Boolean(videoFile)}
        onChange={(e) => {
          if (!e.target.files) return
          addFiles(Array.from(e.target.files))
          e.target.value = ''
        }}
      />
      <input
        id={videoInputId}
        type="file"
        accept="video/mp4,video/webm"
        className="hidden"
        disabled={files.length > 0 || Boolean(videoFile)}
        onChange={(e) => {
          void addVideo(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      <div className="flex gap-3">
        {/* User avatar */}
        <div className="hidden sm:flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-blue-50 ring-2 ring-white shadow-sm dark:from-gray-800 dark:to-gray-700 dark:ring-gray-800">
          {avatar.path && avatarUrl ? (
            <Image src={avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
              {avatar.displayName?.charAt(0)?.toUpperCase() || '?'}
            </span>
          )}
        </div>

        {/* Textarea container */}
        <div
          className={`relative flex-1 min-w-0 rounded-2xl border transition-colors ${
            isDragActive
              ? 'border-dashed border-blue-400 bg-blue-50/50 dark:border-blue-600 dark:bg-blue-900/20'
              : 'border-transparent'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            if (canAddMore) setIsDragActive(true)
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              const value = e.target.value.slice(0, MAX_CONTENT_LENGTH)
              setContent(value)
              setAiAssistedApplied(false)
              updateMentionState(value, e.target.selectionStart ?? value.length)
            }}
            onClick={(e) => updateMentionState(content, e.currentTarget.selectionStart ?? 0)}
            onKeyUp={(e) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
              updateMentionState(content, e.currentTarget.selectionStart ?? 0)
            }}
            onKeyDown={(e) => {
              if (!mentionTrigger || mentionDismissed) return
              if (e.key === 'Escape') {
                e.preventDefault()
                setMentionDismissed(true)
                return
              }
              if (mentionResults.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setMentionActiveIndex((i) => (i + 1) % mentionResults.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setMentionActiveIndex((i) => (i - 1 + mentionResults.length) % mentionResults.length)
              } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                selectMention(mentionResults[mentionActiveIndex])
              }
            }}
            placeholder={t('composer.placeholder', 'Ką norite pasidalinti?')}
            maxLength={MAX_CONTENT_LENGTH}
            rows={3}
            role="combobox"
            aria-expanded={Boolean(
              mentionTrigger && !mentionDismissed && (mentionLoading || mentionResults.length > 0)
            )}
            aria-controls={mentionListboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              mentionTrigger && !mentionDismissed && mentionResults[mentionActiveIndex]
                ? `${mentionListboxId}-option-${mentionActiveIndex}`
                : undefined
            }
            className="w-full resize-none bg-transparent text-base text-slate-800 placeholder-slate-400 outline-none px-1 dark:text-gray-100 dark:placeholder-gray-500"
          />

          {/* Mentions dropdown */}
          {mentionTrigger && !mentionDismissed && (mentionLoading || mentionResults.length > 0) && (
            <div
              id={mentionListboxId}
              role="listbox"
              aria-label="Vartotojų pasiūlymai"
              className="absolute left-1 top-full z-20 mt-1 w-64 max-w-[calc(100%-0.5rem)] rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden dark:border-gray-700 dark:bg-gray-900"
            >
              {mentionLoading && mentionResults.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-slate-400 dark:text-gray-500">
                  {t('composer.searching', 'Ieškoma...')}
                </div>
              ) : (
                mentionResults.map((user, index) => (
                  <button
                    key={user.id}
                    id={`${mentionListboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === mentionActiveIndex}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectMention(user)
                    }}
                    onMouseEnter={() => setMentionActiveIndex(index)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors ${
                      index === mentionActiveIndex
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-slate-50 dark:hover:bg-gray-800/50 text-slate-700 dark:text-gray-200'
                    }`}
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-[10px] font-bold text-blue-600 dark:bg-gray-800 dark:text-blue-400">
                      {user.avatarPath ? (
                        <img
                          src={
                            resolveSupabaseStorageUrl(
                              (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
                              user.avatarPath
                            ) || ''
                          }
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user.displayName?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{user.displayName}</span>
                      <span className="block truncate text-[10px] text-slate-400 dark:text-gray-500">
                        @{user.username}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Photo Previews */}
          {files.length > 0 && (
            <div className="flex gap-2 mb-3 overflow-x-auto -mx-1 px-1 py-1">
              {previews.map(({ url }, i) => (
                <div
                  key={i}
                  className="group relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm dark:border-gray-700"
                >
                  <Image src={url} alt="" fill sizes="80px" className="object-cover pointer-events-none" unoptimized />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    aria-label={`Pašalinti nuotrauką ${i + 1}`}
                    className="absolute top-1 right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-black/80 transition-colors"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Video Preview */}
          {videoFile && videoPreviewUrl && (
            <div className="mb-3">
              <div className="group relative w-full max-w-xs aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-black dark:border-gray-700">
                <video
                  src={videoPreviewUrl}
                  className="h-full w-full object-contain"
                  controls
                  muted
                  preload="metadata"
                  aria-label="Pasirinkto vaizdo įrašo peržiūra"
                />
                <button
                  type="button"
                  onClick={() => setVideoFile(null)}
                  aria-label="Pašalinti vaizdo įrašą"
                  className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-sm hover:bg-black/90 transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            </div>
          )}

          {/* YouTube Attachment Chip */}
          {youtube && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-xl border border-red-200/80 bg-red-50/70 px-3 py-1.5 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              <VideoIcon size={14} className="text-red-600 dark:text-red-400" />
              <span className="max-w-[220px] sm:max-w-xs truncate font-medium">{youtube}</span>
              <button
                type="button"
                onClick={() => setYoutube('')}
                aria-label="Pašalinti YouTube nuorodą"
                className="text-red-500 hover:text-red-700 dark:hover:text-red-200"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Link Preview Loading & Card */}
          {linkPreviewLoading && (
            <div className="mb-3 flex items-center gap-3 rounded-2xl border border-slate-200 p-2.5 animate-pulse dark:border-gray-800">
              <div className="h-12 w-12 flex-shrink-0 rounded-xl bg-slate-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-gray-700" />
                <div className="h-2.5 w-1/3 rounded bg-slate-200 dark:bg-gray-700" />
              </div>
            </div>
          )}

          {!linkPreviewLoading && linkPreview && (
            <div className="group relative mb-3 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/50 p-2.5 dark:border-gray-800 dark:bg-gray-800/40">
              {linkPreview.image ? (
                <div className="relative h-12 w-12 flex-shrink-0 rounded-xl overflow-hidden bg-slate-200 dark:bg-gray-700">
                  <img
                    src={linkPreview.image}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-400 dark:bg-gray-700 dark:text-gray-500">
                  <LinkIcon size={18} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {linkPreview.title && (
                  <p className="text-xs font-semibold text-slate-800 truncate dark:text-gray-200">{linkPreview.title}</p>
                )}
                <p className="text-[10px] text-slate-400 truncate dark:text-gray-500">
                  {new URL(linkPreview.url).hostname}
                </p>
              </div>
              <button
                type="button"
                onClick={removeLinkPreview}
                aria-label="Pašalinti nuorodos peržiūrą"
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* AI Suggestion Preview Card */}
          {aiSuggestion && (
            <div className="mb-3 rounded-2xl border border-violet-200/80 bg-violet-50/40 p-3 space-y-2 dark:border-violet-900/50 dark:bg-violet-950/20 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between text-xs font-semibold text-violet-700 dark:text-violet-300">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} />
                  {t('composer.aiPreviewTitle', 'AI pasiūlymas')}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-gray-500 font-normal">
                  Peržiūrėkite prieš pritaikydami
                </span>
              </div>
              <p className="text-xs text-slate-700 whitespace-pre-wrap dark:text-gray-200 leading-relaxed">
                {aiSuggestion}
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={applyAiSuggestion}
                  className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-3.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
                >
                  <Check size={13} /> {t('composer.aiApply', 'Naudoti')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAiSuggestion('')
                    setAiSuggestionAction(null)
                  }}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
                >
                  {t('common.cancel', 'Atšaukti')}
                </button>
              </div>
            </div>
          )}

          {/* Error messages */}
          {aiError && (
            <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">
              {aiError}
            </p>
          )}
          {postError && (
            <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
              {postError}
            </p>
          )}
          {videoError && (
            <p role="alert" className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600 dark:bg-red-950/20 dark:text-red-400">
              {videoError}
            </p>
          )}
        </div>
      </div>

      {/* Composer Bottom Action Bar */}
      <div className="flex items-center justify-between border-t border-slate-100 pt-3 dark:border-gray-800/80">
        <div className="flex items-center gap-2">
          {/* Compact Attachment Menu (+) */}
          <AttachmentMenu
            imageInputId={fileInputId}
            videoInputId={videoInputId}
            imagesCount={files.length}
            maxImages={MAX_ATTACHMENTS}
            hasVideo={Boolean(videoFile)}
            youtubeUrl={youtube}
            onYoutubeChange={setYoutube}
            disabled={loading}
          />

          {/* Compact AI Helper Button (✨ AI) */}
          <AIComposerMenu
            onRunAction={handleAiAction}
            disabled={loading || !content.trim()}
            loadingAction={aiLoading}
          />

          {aiAssistedApplied && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/40 dark:text-violet-300">
              <Sparkles size={11} /> AI
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-xs ${nearLimit ? 'font-medium text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-gray-500'}`}>
            {remainingChars}
          </span>
          <button
            type="button"
            onClick={handlePost}
            disabled={loading || (!content.trim() && files.length === 0 && !videoFile && !youtube)}
            className="flex min-h-[38px] items-center gap-2 rounded-full bg-gradient-to-r from-[#1A1A2E] to-[#16213E] px-5 py-1.5 text-xs font-semibold text-white shadow-sm hover:shadow-md hover:shadow-slate-900/20 disabled:opacity-40 disabled:cursor-not-allowed dark:from-blue-600 dark:to-indigo-600 transition-all hover:-translate-y-0.5"
          >
            {loading ? (
              uploadStep || t('composer.posting', 'Skelbiama...')
            ) : (
              <>
                <Send size={13} /> {t('composer.post', 'Skelbti')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
