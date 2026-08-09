import { z } from 'zod'
import { requireSession } from '@/lib/auth-session'
import { uploadObject } from '@/lib/object-storage'
import {
  allowedImageContentTypes,
  sanitizeImageUpload,
} from '@/lib/image-security'
import {
  allowedVideoContentTypes,
  sanitizeVideoUpload,
  MAX_VIDEO_BYTES,
} from '@/lib/video-security'
import { rateLimit } from '@/lib/rate-limit'

const querySchema = z.object({
  // Video posts reuse the existing 'post-images' bucket (see
  // db/migrations/0011_video_posts.sql) rather than requiring a new bucket
  // to be provisioned in MinIO before this can ship.
  bucket: z.literal('post-images'),
  path: z.string().min(1).max(500),
})

const maxImageBytes = 10 * 1024 * 1024
// Videos get their own, stricter rate limit — fewer, larger uploads than
// images, on the same per-user key namespace as the image limiter so the
// two don't share (and can't be used to double a single budget).
const uploadLimiter = rateLimit({
  limit: 30,
  windowMs: 10 * 60 * 1000,
})
const videoUploadLimiter = rateLimit({
  limit: 10,
  windowMs: 10 * 60 * 1000,
})

export async function PUT(request: Request) {
  try {
    const session = await requireSession()
    const url = new URL(request.url)
    const parsed = querySchema.safeParse({
      bucket: url.searchParams.get('bucket'),
      path: url.searchParams.get('path'),
    })
    const contentType = request.headers.get('content-type') || ''
    const contentLength = Number(request.headers.get('content-length') || 0)
    const isVideo = allowedVideoContentTypes.has(contentType as 'video/mp4' | 'video/webm')
    const isImage = allowedImageContentTypes.has(
      contentType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
    )

    if (
      !parsed.success ||
      (!isImage && !isVideo) ||
      contentLength <= 0 ||
      contentLength > (isVideo ? MAX_VIDEO_BYTES : maxImageBytes)
    ) {
      return Response.json({ error: 'INVALID_UPLOAD' }, { status: 400 })
    }
    if (!parsed.data.path.startsWith(`${session.user.id}/`)) {
      return Response.json({ error: 'FORBIDDEN_PATH' }, { status: 403 })
    }

    const limitResult = isVideo
      ? await videoUploadLimiter.check(`video-upload:${session.user.id}`)
      : await uploadLimiter.check(`image-upload:${session.user.id}`)
    if (!limitResult.success) {
      return Response.json(
        { error: 'RATE_LIMITED' },
        {
          status: 429,
          headers: { 'Retry-After': String(limitResult.resetIn) },
        },
      )
    }

    const body = new Uint8Array(await request.arrayBuffer())
    let sanitized
    try {
      sanitized = isVideo
        ? await sanitizeVideoUpload(body, contentType)
        : await sanitizeImageUpload(body, contentType)
    } catch {
      return Response.json({ error: isVideo ? 'INVALID_VIDEO' : 'INVALID_IMAGE' }, { status: 400 })
    }
    await uploadObject(
      parsed.data.bucket,
      parsed.data.path,
      sanitized.body,
      sanitized.contentType,
    )
    return Response.json({ path: parsed.data.path, mediaType: isVideo ? 'video' : 'image' })
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const unauthorized = message === 'UNAUTHORIZED'
    return Response.json(
      {
        error: unauthorized
          ? 'UNAUTHORIZED'
          : 'STORAGE_ERROR',
      },
      { status: unauthorized ? 401 : 500 },
    )
  }
}
