import { jwtVerify } from 'jose'
import { getObject } from '@/lib/object-storage'

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token')
    const secret = process.env.BETTER_AUTH_SECRET
    if (!token || !secret) {
      return Response.json({ error: 'INVALID_LINK' }, { status: 400 })
    }

    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
    )
    if (
      payload.bucket !== 'receipts' ||
      typeof payload.key !== 'string'
    ) {
      return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
    }

    const object = await getObject(payload.bucket, payload.key)
    if (!object.Body) {
      return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
    }
    return new Response(object.Body.transformToWebStream(), {
      headers: {
        'Content-Type': object.ContentType || 'application/octet-stream',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch {
    return Response.json({ error: 'INVALID_OR_EXPIRED_LINK' }, { status: 403 })
  }
}
