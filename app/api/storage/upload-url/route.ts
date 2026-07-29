import { z } from 'zod'
import { requireSession } from '@/lib/auth-session'
import { createUploadUrl } from '@/lib/object-storage'

const requestSchema = z.object({
  bucket: z.literal('post-images'),
  path: z.string().min(1).max(500),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
})

export async function POST(request: Request) {
  try {
    const session = await requireSession()
    const parsed = requestSchema.safeParse(await request.json())

    if (!parsed.success) {
      return Response.json({ error: 'INVALID_UPLOAD' }, { status: 400 })
    }

    if (!parsed.data.path.startsWith(`${session.user.id}/`)) {
      return Response.json({ error: 'FORBIDDEN_PATH' }, { status: 403 })
    }

    const url = await createUploadUrl(
      parsed.data.bucket,
      parsed.data.path,
      parsed.data.contentType,
    )

    return Response.json({ url, path: parsed.data.path })
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED'
    return Response.json(
      { error: unauthorized ? 'UNAUTHORIZED' : 'STORAGE_ERROR' },
      { status: unauthorized ? 401 : 500 },
    )
  }
}
