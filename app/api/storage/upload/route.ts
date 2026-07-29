import { z } from 'zod'
import { requireSession } from '@/lib/auth-session'
import { uploadObject } from '@/lib/object-storage'

const querySchema = z.object({
  bucket: z.literal('post-images'),
  path: z.string().min(1).max(500),
})

const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])
const maxBytes = 10 * 1024 * 1024

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

    if (
      !parsed.success ||
      !allowedTypes.has(contentType) ||
      contentLength <= 0 ||
      contentLength > maxBytes
    ) {
      return Response.json({ error: 'INVALID_UPLOAD' }, { status: 400 })
    }
    if (!parsed.data.path.startsWith(`${session.user.id}/`)) {
      return Response.json({ error: 'FORBIDDEN_PATH' }, { status: 403 })
    }

    const body = new Uint8Array(await request.arrayBuffer())
    if (body.byteLength > maxBytes) {
      return Response.json({ error: 'FILE_TOO_LARGE' }, { status: 413 })
    }
    await uploadObject(
      parsed.data.bucket,
      parsed.data.path,
      body,
      contentType,
    )
    return Response.json({ path: parsed.data.path })
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED'
    return Response.json(
      { error: unauthorized ? 'UNAUTHORIZED' : 'STORAGE_ERROR' },
      { status: unauthorized ? 401 : 500 },
    )
  }
}
