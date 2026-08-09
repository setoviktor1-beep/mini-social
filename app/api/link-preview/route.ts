import { z } from 'zod'
import { requireSession } from '@/lib/auth-session'
import { executePostgrest } from '@/lib/backend/postgrest'
import { fetchLinkPreview, LinkPreviewError } from '@/lib/link-preview'
import { rateLimit } from '@/lib/rate-limit'

const bodySchema = z.object({
  url: z.string().min(1).max(2000),
})

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

const previewLimiter = rateLimit({
  limit: 20,
  windowMs: 10 * 60 * 1000,
})

export async function POST(request: Request) {
  let session
  try {
    session = await requireSession()
  } catch {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  const limitResult = await previewLimiter.check(`link-preview:${session.user.id}`)
  if (!limitResult.success) {
    return Response.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(limitResult.resetIn) } },
    )
  }

  const url = parsed.data.url

  const cached = await executePostgrest<{ url: string; title: string | null; description: string | null; image_url: string | null; fetched_at: string }>(
    {
      table: 'link_previews',
      method: 'GET',
      filters: [['url', `eq.${url}`]],
      order: [],
      single: 'maybeSingle',
    },
    { kind: 'service' },
  )

  if (!cached.error && cached.data) {
    const age = Date.now() - new Date(cached.data.fetched_at).getTime()
    if (age < CACHE_TTL_MS) {
      return Response.json({
        url: cached.data.url,
        title: cached.data.title,
        description: cached.data.description,
        image: cached.data.image_url,
      })
    }
  }

  try {
    const preview = await fetchLinkPreview(url)

    await executePostgrest(
      {
        table: 'link_previews',
        method: 'POST',
        body: {
          url,
          title: preview.title,
          description: preview.description,
          image_url: preview.image,
          fetched_at: new Date().toISOString(),
        },
        upsert: { onConflict: 'url' },
        filters: [],
        order: [],
      },
      { kind: 'service' },
    )

    return Response.json(preview)
  } catch (error) {
    // Audit/error logging without exposing the target URL's full query
    // string or any response content — just enough to see failure
    // patterns (rate of SSRF attempts, timeouts, etc.) without leaking
    // what a user tried to preview.
    const reason = error instanceof LinkPreviewError ? error.message : 'UNKNOWN'
    console.error('[link-preview] fetch failed', { reason, host: safeHostForLogging(url) })

    const status = reason === 'BLOCKED_ADDRESS' || reason === 'UNSUPPORTED_PROTOCOL' || reason === 'INVALID_URL'
      ? 400
      : reason === 'TIMEOUT'
        ? 504
        : 502
    return Response.json({ error: 'PREVIEW_UNAVAILABLE', reason }, { status })
  }
}

function safeHostForLogging(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return 'invalid'
  }
}
