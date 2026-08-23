'use client'
import { useState, useEffect, useMemo, useId, useCallback, useRef } from 'react'
import { createClient } from '@/lib/backend-client'
import { useRouter } from 'next/navigation'
import { Image as ImageIcon, Video, Film, Send, X, Sparkles, Loader2, Check, Link as LinkIcon } from 'lucide-react'
import Image from 'next/image'
import { notifyMentions, detectMentionTrigger, type MentionTrigger } from '@/lib/mentions'
import { extractYoutubeId, normalizeYoutubeUrl, resolveSupabaseStorageUrl, extractFirstPreviewableUrl } from '@/lib/media'
import { useI18n } from '@/lib/i18n'

interface MentionSuggestion {
  id: string
  username: string
  displayName: string
  avatarPath: string | null
}

const MAX_ATTACHMENTS = 5
const MAX_CONTENT_LENGTH = 2000
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm'])
const MAX_VIDEO_BYTES = 50 * 1024 * 1024 // 50MB — kept in sync with lib/video-security.ts's MAX_VIDEO_BYTES
const MAX_VIDEO_DURATION_SECONDS = 120 // kept in sync with lib/video-security.ts's MAX_VIDEO_DURATION_SECONDS

// Client-side check only — a UX safeguard so obviously-wrong files never
// reach the network, not the security boundary. lib/video-security.ts
// enforces this again server-side from the real file bytes regardless of
// what this reports.
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
  // The URL a preview was explicitly dismissed for — kept so we don't
  // immediately refetch it while the user is still editing text around
  // the same link. Cleared if the content no longer contains that URL.
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
  const [showAiPanel, setShowAiPanel] = useState(false)
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiSuggestionAction, setAiSuggestionAction] = useState<string | null>(null)
  const [aiError, setAiError] = useState('')
  const [aiTone, setAiTone] = useState('draugišką')
  const [aiLanguage, setAiLanguage] = useState('anglų')
  const [aiAssistedApplied, setAiAssistedApplied] = useState(false)
  const fileInputId = useId()
  const videoInputId = useId()
  // UX5: Memoize supabase client to prevent recreation causing re-render loops
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  // CB2: Reset composer state when the authenticated user changes
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

  // A post is either images (up to MAX_ATTACHMENTS) or a single video, not
  // both — matches the post_media schema query in PostCard (a post's media
  // is rendered as either an image grid or a single video player) and
  // keeps the upload/cleanup logic below from having to reason about mixed
  // failure states across two attachment kinds in the same post.
  const addFiles = useCallback((incoming: File[]) => {
    const images = incoming.filter((file) => file.type.startsWith('image/'))
    if (images.length === 0) return
    setVideoFile(null)
    setVideoError('')
    setFiles((prev) => [...prev, ...images].slice(0, MAX_ATTACHMENTS))
  }, [])

  const addVideo = useCallback(async (incoming: File | undefined) => {
    if (!incoming) return
    setVideoError('')
    if (!ALLOWED_VIDEO_TYPES.has(incoming.type)) {
      setVideoError('Palaikomi tik MP4 ir WebM vaizdo įrašai.')
      return
    }
    if (incoming.size > MAX_VIDEO_BYTES) {
      setVideoError('Vaizdo įrašas per didelis (maks. 50MB).')
      return
    }
    const duration = await readVideoDurationSeconds(incoming)
    if (duration !== null && duration > MAX_VIDEO_DURATION_SECONDS) {
      setVideoError('Vaizdo įrašas per ilgas (maks. 2 min.).')
      return
    }
    setFiles([])
    setVideoFile(incoming)
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

  // Debounced link-preview fetch: detect a URL in the content, wait for
  // typing to settle, then ask the server to fetch/sanitize a preview.
  // Never fetches from the browser directly — see app/api/link-preview/route.ts.
  useEffect(() => {
    const url = extractFirstPreviewableUrl(content)

    if (!url) {
      setLinkPreview(null)
      setLinkPreviewError(false)
      setDismissedPreviewUrl(null)
      return
    }
    if (url === dismissedPreviewUrl) return
    if (linkPreview?.url === url) return

    setLinkPreviewError(false)
    const timeout = setTimeout(async () => {
      setLinkPreviewLoading(true)
      try {
        const res = await fetch('/api/link-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        })
        if (!res.ok) {
          setLinkPreviewError(true)
          setLinkPreview(null)
          return
        }
        const data = await res.json()
        setLinkPreview({ url, title: data.title, description: data.description, image: data.image })
      } catch {
        setLinkPreviewError(true)
        setLinkPreview(null)
      } finally {
        setLinkPreviewLoading(false)
      }
    }, 600)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, dismissedPreviewUrl])

  const removeLinkPreview = () => {
    if (linkPreview) setDismissedPreviewUrl(linkPreview.url)
    setLinkPreview(null)
    setLinkPreviewError(false)
  }

  // Recomputes the @-mention trigger from the textarea's current cursor
  // position. Called after every content change and every cursor
  // movement (click, arrow keys, selection change) — a mention trigger is
  // about cursor position within the text, not just the text itself.
  const updateMentionState = useCallback((text: string, cursor: number) => {
    const trigger = detectMentionTrigger(text, cursor)
    setMentionTrigger((prev) => {
      const changed = !trigger || !prev || prev.start !== trigger.start || prev.query !== trigger.query
      if (changed) setMentionDismissed(false)
      return trigger
    })
  }, [])

  // Debounced, cancellable mention search. mentionAbortRef ensures a
  // slow earlier request can never overwrite the results of a faster
  // later one (aborting it outright, not just ignoring its response).
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
    // Composer works normally even if this fails for any reason — the
    // mention text itself was already inserted above regardless.
    requestAnimationFrame(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.setSelectionRange(cursorPos, cursorPos)
    })
  }

  const handleAiAction = async (action: 'rewrite' | 'tone' | 'translate' | 'spelling' | 'hashtags') => {
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
        body: JSON.stringify({ action, text: content, tone: aiTone, targetLanguage: aiLanguage }),
        signal: controller.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const code = data?.error
        setAiError(
          code === 'AI_UNAVAILABLE' ? 'AI įrankiai šiuo metu nepasiekiami. Pabandykite vėliau.'
          : code === 'QUOTA_EXCEEDED' ? (data?.message || 'Pasiekėte mėnesinę AI naudojimo ribą.')
          : code === 'RATE_LIMITED' ? 'Per daug AI užklausų per trumpą laiką. Palaukite ir bandykite dar kartą.'
          : code === 'TEXT_TOO_LONG' ? 'Tekstas per ilgas AI apdorojimui.'
          : code === 'AI_REQUEST_FAILED' ? 'AI paslauga negrąžino atsakymo. Bandykite dar kartą.'
          : 'Nepavyko gauti AI pasiūlymo. Bandykite dar kartą.'
        )
        return
      }
      setAiSuggestion(data.suggestion || '')
      setAiSuggestionAction(action)
    } catch (err) {
      setAiError(
        (err as Error)?.name === 'AbortError'
          ? 'AI užklausa užtruko per ilgai ir buvo nutraukta. Bandykite dar kartą.'
          : 'Nepavyko prisijungti prie AI paslaugos.'
      )
    } finally {
      clearTimeout(timeout)
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
    setAiAssistedApplied(true)
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

    if (!finalContent && files.length === 0 && !videoFile && !youtubeId) {
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

    // Only attach the preview if it's still for a URL actually present in
    // the content being posted — the user may have edited the text after
    // the preview loaded (e.g. deleted the link) without explicitly
    // dismissing it.
    const activePreview = linkPreview && extractFirstPreviewableUrl(finalContent) === linkPreview.url ? linkPreview : null

    const { data: post, error } = await supabase.from('posts').insert({
      user_id: userId,
      content: finalContent,
      youtube_url: normalizedYoutubeUrl,
      youtube_video_id: youtubeId,
      link_preview_url: activePreview?.url ?? null,
      link_preview_title: activePreview?.title ?? null,
      link_preview_description: activePreview?.description ?? null,
      link_preview_image: activePreview?.image ?? null,
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

    if (videoFile) {
      setUploadStep('Įkeliamas vaizdo įrašas...')
      const path = `${userId}/${Date.now()}_${videoFile.name}`
      // No client-side re-encoding for video (see lib/video-security.ts) —
      // the raw file goes up as-is; the server validates its real
      // signature/size/duration from the bytes regardless of what this
      // client believes about it.
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
        setPostError('Nepavyko susieti vaizdo įrašo su įrašu. Bandykite dar kartą.')
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
    setShowAiPanel(false)
    setAiSuggestion('')
    setAiSuggestionAction(null)
    setAiAssistedApplied(false)
    router.refresh()
  }

  const remainingChars = MAX_CONTENT_LENGTH - content.length
  const nearLimit = remainingChars <= 100
  const canAddMore = files.length < MAX_ATTACHMENTS

  return (
    <div className="border-b border-slate-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:pb-4">
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
        <div className="hidden sm:flex w-10 h-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-blue-50 ring-2 ring-white dark:ring-gray-900 shadow-sm">
          {avatar.path && avatarUrl ? (
            <Image src={avatarUrl} alt="" width={40} height={40} className="h-full w-full object-cover" unoptimized />
          ) : (
            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{avatar.displayName?.charAt(0)?.toUpperCase() || '?'}</span>
          )}
        </div>

        <div
          className={`relative flex-1 min-w-0 rounded-2xl border transition-colors ${
            isDragActive ? 'border-dashed border-blue-400 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/20' : 'border-transparent'
          }`}
          onDragOver={(e) => { e.preventDefault(); if (canAddMore) setIsDragActive(true) }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => {
              const value = e.target.value.slice(0, MAX_CONTENT_LENGTH)
              setContent(value)
              setAiAssistedApplied(false)
              updateMentionState(value, e.target.selectionStart ?? value.length)
            }}
            onClick={e => updateMentionState(content, e.currentTarget.selectionStart ?? 0)}
            onKeyUp={e => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
              updateMentionState(content, e.currentTarget.selectionStart ?? 0)
            }}
            onKeyDown={(e) => {
              if (!mentionTrigger || mentionDismissed) return
              // Escape must work even while results are still loading (the
              // dropdown is already visible at that point, showing a
              // loading state) — gating it on mentionResults.length > 0
              // like the navigation keys below meant an Escape pressed
              // before the debounced search resolved was silently
              // swallowed, and the dropdown reappeared moments later when
              // results arrived, looking like Escape had no effect at all.
              if (e.key === 'Escape') {
                e.preventDefault()
                setMentionDismissed(true)
                return
              }
              if (mentionResults.length === 0) return
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setMentionActiveIndex(i => (i + 1) % mentionResults.length)
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setMentionActiveIndex(i => (i - 1 + mentionResults.length) % mentionResults.length)
              } else if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault()
                selectMention(mentionResults[mentionActiveIndex])
              }
            }}
            placeholder={t('composer.placeholder', "Ką galvojate?")}
            maxLength={MAX_CONTENT_LENGTH}
            role="combobox"
            aria-expanded={Boolean(mentionTrigger && !mentionDismissed && (mentionLoading || mentionResults.length > 0))}
            aria-controls={mentionListboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              mentionTrigger && !mentionDismissed && mentionResults[mentionActiveIndex]
                ? `${mentionListboxId}-option-${mentionActiveIndex}`
                : undefined
            }
            className="w-full min-h-[86px] resize-none bg-transparent text-base sm:text-lg text-slate-800 dark:text-gray-200 placeholder-slate-400 dark:placeholder-gray-500 outline-none px-1"
          />

          {mentionTrigger && !mentionDismissed && (mentionLoading || mentionResults.length > 0) && (
            <div
              id={mentionListboxId}
              role="listbox"
              aria-label="Vartotojų pasiūlymai"
              className="absolute left-1 top-full z-20 mt-1 w-64 max-w-[calc(100%-0.5rem)] rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg overflow-hidden"
            >
              {mentionLoading && mentionResults.length === 0 ? (
                <div className="px-3 py-2.5 text-sm text-slate-400 dark:text-gray-500">{t('composer.searching', 'Ieškoma...')}</div>
              ) : (
                mentionResults.map((user, index) => (
                  <button
                    key={user.id}
                    id={`${mentionListboxId}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === mentionActiveIndex}
                    // onMouseDown (not onClick) fires before the textarea's
                    // onBlur would otherwise close this dropdown first.
                    onMouseDown={(e) => { e.preventDefault(); selectMention(user) }}
                    onMouseEnter={() => setMentionActiveIndex(index)}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                      index === mentionActiveIndex ? 'bg-blue-50 dark:bg-blue-900/30' : 'hover:bg-slate-50 dark:hover:bg-gray-800/50'
                    }`}
                  >
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-blue-50 text-xs font-bold text-blue-600 dark:text-blue-400">
                      {user.avatarPath ? (
                        <img
                          src={resolveSupabaseStorageUrl(
                            (path) => supabase.storage.from('post-images').getPublicUrl(path).data.publicUrl,
                            user.avatarPath
                          ) || ''}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user.displayName?.charAt(0)?.toUpperCase() || '?'
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-slate-800 dark:text-gray-200">{user.displayName}</span>
                      <span className="block truncate text-xs text-slate-400 dark:text-gray-500">@{user.username}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {files.length > 0 && (
            <div className="flex gap-2 mb-3 sm:mb-4 overflow-x-auto -mx-1 px-1">
              {previews.map(({ file, url }, i) => (
                <div key={i} className="group relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden flex-shrink-0 border border-slate-200 dark:border-gray-700 shadow-sm">
                  <Image src={url} alt="" fill sizes="80px" className="object-cover pointer-events-none" unoptimized />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                    aria-label={`Pašalinti nuotrauką ${i + 1}`}
                    className="absolute top-1 right-1 z-10 bg-black/50 dark:bg-black/70 text-white rounded-full p-0.5 min-w-[24px] min-h-[24px] flex items-center justify-center hover:bg-black/70 dark:hover:bg-black/80 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {videoFile && videoPreviewUrl && (
            <div className="mb-3 sm:mb-4">
              <div className="group relative w-full max-w-xs aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-gray-700 shadow-sm bg-black">
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
                  className="absolute top-1 right-1 z-10 bg-black/50 dark:bg-black/70 text-white rounded-full p-0.5 min-w-[24px] min-h-[24px] flex items-center justify-center hover:bg-black/70 dark:hover:bg-black/80 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {linkPreviewLoading && (
            <div className="mb-3 sm:mb-4 flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-700 p-3 animate-pulse">
              <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-slate-200 dark:bg-gray-700" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-gray-700" />
                <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-gray-700" />
              </div>
            </div>
          )}

          {!linkPreviewLoading && linkPreview && (
            <div className="mb-3 sm:mb-4 group relative flex items-center gap-3 rounded-xl border border-slate-200 dark:border-gray-700 p-3 bg-slate-50/50 dark:bg-gray-800/30">
              {linkPreview.image ? (
                <div className="relative h-14 w-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-gray-700">
                  {/* Remote OG images come from arbitrary third-party hosts,
                      so next/image's optimizer (which would need every host
                      allowlisted) is skipped here — same reasoning as
                      avatar/post images elsewhere in this app. */}
                  <img
                    src={linkPreview.image}
                    alt=""
                    className="h-full w-full object-cover"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                  />
                </div>
              ) : (
                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-gray-700 text-slate-400 dark:text-gray-500">
                  <LinkIcon size={20} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                {linkPreview.title && (
                  <p className="text-sm font-semibold text-slate-800 dark:text-gray-200 truncate">{linkPreview.title}</p>
                )}
                {linkPreview.description && (
                  <p className="text-xs text-slate-500 dark:text-gray-400 line-clamp-1">{linkPreview.description}</p>
                )}
                <p className="text-xs text-slate-400 dark:text-gray-500 truncate">{new URL(linkPreview.url).hostname}</p>
              </div>
              <button
                type="button"
                onClick={removeLinkPreview}
                aria-label="Pašalinti nuorodos peržiūrą"
                title="Pašalinti nuorodos peržiūrą"
                className="absolute top-1 right-1 bg-white/90 dark:bg-gray-900/90 text-slate-500 dark:text-gray-400 rounded-full p-1 min-w-[28px] min-h-[28px] flex items-center justify-center hover:bg-white dark:hover:bg-gray-800 hover:text-slate-700 dark:hover:text-gray-300 shadow-sm transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {!linkPreviewLoading && linkPreviewError && (
            <p className="mb-3 sm:mb-4 text-xs text-slate-400 dark:text-gray-500">
              Nepavyko įkelti nuorodos peržiūros — įrašas bus paskelbtas su paprasta nuoroda.
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-gray-800 pt-3">
        {postError && (
        <p className="text-sm text-red-500 dark:text-red-400 mb-2 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-lg" role="alert">{postError}</p>
        )}
        {videoError && (
        <p className="text-sm text-red-500 dark:text-red-400 mb-2 bg-red-50 dark:bg-red-900/10 px-3 py-2 rounded-lg" role="alert">{videoError}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <label
            htmlFor={fileInputId}
            className={`flex w-fit min-h-[44px] items-center gap-2 text-sm px-2 rounded-lg transition-colors ${
              canAddMore
                ? 'cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                : 'cursor-not-allowed text-slate-300 dark:text-gray-600'
            }`}
          >
            <ImageIcon size={18} />
            <span>{t('composer.addImage', 'Nuotraukos')}{files.length > 0 ? ` (${files.length}/${MAX_ATTACHMENTS})` : ''}</span>
          </label>
          <label
            htmlFor={videoInputId}
            className={`flex w-fit min-h-[44px] items-center gap-2 text-sm px-2 rounded-lg transition-colors ${
              files.length === 0 && !videoFile
                ? 'cursor-pointer text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                : 'cursor-not-allowed text-slate-300 dark:text-gray-600'
            }`}
          >
            <Film size={18} />
            <span>{t('composer.addVideo', 'Vaizdo įrašas')}</span>
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
              className="min-h-[44px] w-full border-b border-transparent bg-transparent text-slate-700 dark:text-gray-300 outline-none focus:border-purple-400 sm:w-40"
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
            <span>{t('composer.aiTools', 'AI įrankiai')}</span>
          </button>
        </div>

        {showAiPanel && (
          <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => handleAiAction('rewrite')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white dark:bg-gray-900 border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'rewrite' ? <Loader2 size={14} className="animate-spin" /> : null} {t('composer.aiRewrite', 'Pagerinti')}
              </button>
              <button type="button" onClick={() => handleAiAction('spelling')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white dark:bg-gray-900 border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'spelling' ? <Loader2 size={14} className="animate-spin" /> : null} {t('composer.aiSpelling', 'Taisyti klaidas')}
              </button>
              <button type="button" onClick={() => handleAiAction('hashtags')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white dark:bg-gray-900 border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'hashtags' ? <Loader2 size={14} className="animate-spin" /> : null} {t('composer.aiHashtags', '#Žymos')}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={aiTone} onChange={(e) => setAiTone(e.target.value)} className="min-h-[36px] rounded-full border border-violet-200 bg-white dark:bg-gray-900 px-2 text-sm text-violet-700">
                <option value="draugišką">draugišką</option>
                <option value="formalų">formalų</option>
                <option value="glaustą">glaustą</option>
                <option value="entuziastingą">entuziastingą</option>
              </select>
              <button type="button" onClick={() => handleAiAction('tone')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white dark:bg-gray-900 border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'tone' ? <Loader2 size={14} className="animate-spin" /> : null} {t('composer.aiTone', 'Tonas')}
              </button>
              <select value={aiLanguage} onChange={(e) => setAiLanguage(e.target.value)} className="min-h-[36px] rounded-full border border-violet-200 bg-white dark:bg-gray-900 px-2 text-sm text-violet-700">
                <option value="anglų">English</option>
                <option value="lietuvių">Lietuvių</option>
                <option value="rusų">Русский</option>
                <option value="lenkų">Polski</option>
                <option value="ukrainiečių">Українська</option>
              </select>
              <button type="button" onClick={() => handleAiAction('translate')} disabled={Boolean(aiLoading)} className="min-h-[36px] px-3 rounded-full bg-white dark:bg-gray-900 border border-violet-200 text-sm text-violet-700 hover:bg-violet-100 disabled:opacity-50 flex items-center gap-1.5">
                {aiLoading === 'translate' ? <Loader2 size={14} className="animate-spin" /> : null} {t('composer.aiTranslate', 'Versti')}
              </button>
            </div>

            {aiError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{aiError}</p>
            )}

            {aiSuggestion && (
              <div className="rounded-xl border border-violet-200 bg-white dark:bg-gray-900 p-3 space-y-2">
                <p className="text-xs font-semibold text-violet-500 uppercase tracking-wide">AI pasiūlymas — peržiūrėkite prieš naudodami</p>
                <p className="text-sm text-slate-700 dark:text-gray-300 whitespace-pre-wrap">{aiSuggestion}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyAiSuggestion}
                    className="min-h-[36px] px-4 rounded-full bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 flex items-center gap-1.5"
                  >
                    <Check size={14} /> {t('composer.aiApply', 'Naudoti')}
                  </button>
                  <button type="button" onClick={() => { setAiSuggestion(''); setAiSuggestionAction(null) }} className="min-h-[36px] px-4 rounded-full border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-gray-400 text-sm hover:bg-slate-50 dark:hover:bg-gray-800/50">
                    {t('common.cancel', 'Atmesti')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className={`text-xs ${nearLimit ? 'text-red-500 dark:text-red-400 font-medium' : 'text-slate-400 dark:text-gray-500'}`}>
              {remainingChars}
            </span>
            {aiAssistedApplied && (
              <span className="flex items-center gap-1 text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                <Sparkles size={12} /> AI
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handlePost}
            disabled={loading}
            className="min-h-[44px] rounded-full bg-gradient-to-r from-[#1A1A2E] to-[#16213E] px-6 py-2 font-semibold text-white hover:shadow-lg hover:shadow-slate-900/20 dark:hover:shadow-black/40 disabled:opacity-50 flex items-center gap-2 transition-all hover:-translate-y-0.5"
          >
            {loading ? (uploadStep || t('composer.posting', 'Skelbiama...')) : <><Send size={16}/> {t('composer.post', 'Skelbti')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
