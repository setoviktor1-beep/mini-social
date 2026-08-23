import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/backend-server'
import { aiGateway } from '@/lib/ai/gateway'
import { handleApiError } from '@/lib/api-error'
import { AiError } from '@/lib/ai/errors'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Prašome prisijungti' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => null)
    const threadId = typeof body?.threadId === 'string' ? body.threadId : undefined
    const message = typeof body?.message === 'string' ? body.message : ''
    const includeBusiness = Boolean(body?.includeBusiness)

    if (!message.trim()) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'Žinutės tekstas privalomas' },
        { status: 400 },
      )
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'anonymous'

    const result = await aiGateway.chat({
      supabase,
      userId: user.id,
      threadId,
      message,
      ip,
      includeBusiness,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json(error.toJSON(), { status: error.status })
    }
    return handleApiError(error, { context: 'POST /api/ai/chat' })
  }
}
