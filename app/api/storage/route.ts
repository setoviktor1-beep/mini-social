import { z } from 'zod'
import { requireSession } from '@/lib/auth-session'
import { deleteObject } from '@/lib/object-storage'

const deleteSchema = z.object({
  bucket: z.literal('post-images'),
  paths: z.array(z.string().min(1).max(500)).min(1).max(25),
})

export async function DELETE(request: Request) {
  try {
    const session = await requireSession()
    const parsed = deleteSchema.safeParse(await request.json())

    if (!parsed.success) {
      return Response.json({ error: 'INVALID_DELETE' }, { status: 400 })
    }

    if (
      parsed.data.paths.some(
        (path) => !path.startsWith(`${session.user.id}/`),
      )
    ) {
      return Response.json({ error: 'FORBIDDEN_PATH' }, { status: 403 })
    }

    await Promise.all(
      parsed.data.paths.map((path) =>
        deleteObject(parsed.data.bucket, path),
      ),
    )

    return Response.json({ ok: true })
  } catch (error) {
    const unauthorized =
      error instanceof Error && error.message === 'UNAUTHORIZED'
    return Response.json(
      { error: unauthorized ? 'UNAUTHORIZED' : 'STORAGE_ERROR' },
      { status: unauthorized ? 401 : 500 },
    )
  }
}
