export function extractYoutubeId(value?: string | null) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  // Regex to match various YouTube URL formats and capture the 11-character video ID
  const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  const match = trimmed.match(youtubeRegex)
  if (match && match[1]) {
    return match[1]
  }

  const normalizedInput = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(normalizedInput)
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

  return null
}

export function normalizeYoutubeUrl(value?: string | null) {
  const videoId = extractYoutubeId(value)
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null
}

export function getYoutubeEmbedUrl(value?: string | null) {
  const videoId = extractYoutubeId(value)
  return videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : null
}

export function isOnlyYoutubeUrl(value?: string | null) {
  if (!value) return false
  const trimmed = value.trim()
  if (!trimmed) return false

  const normalized = normalizeYoutubeUrl(trimmed)
  if (!normalized) return false

  const withoutTrailingSlash = trimmed.replace(/\/+$/, '')
  return (
    withoutTrailingSlash === normalized ||
    withoutTrailingSlash === normalized.replace(/^https?:\/\//, '') ||
    withoutTrailingSlash.startsWith('youtube.com/') ||
    withoutTrailingSlash.startsWith('www.youtube.com/') ||
    withoutTrailingSlash.startsWith('youtu.be/')
  )
}

export function resolveSupabaseStorageUrl(
  getPublicUrl: (path: string) => string,
  storagePath?: string | null
) {
  if (!storagePath) return null

  const trimmed = storagePath.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  return getPublicUrl(trimmed)
}
