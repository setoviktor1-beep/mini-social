import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/backend-server'
import { aiGateway } from '@/lib/ai/gateway'
import { handleApiError } from '@/lib/api-error'
import { AiError } from '@/lib/ai/errors'

export const runtime = 'nodejs'

type ComposeAction = 'rewrite' | 'tone' | 'translate' | 'spelling' | 'hashtags' | 'summarize'

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'anonymous'

    const body = await request.json().catch(() => null)
    const action = body?.action as ComposeAction | undefined
    const text = typeof body?.text === 'string' ? body.text : ''
    const tone = typeof body?.tone === 'string' ? body.tone : undefined
    const targetLanguage =
      typeof body?.targetLanguage === 'string' ? body.targetLanguage : undefined

    const validActions: ComposeAction[] = [
      'rewrite',
      'tone',
      'translate',
      'spelling',
      'hashtags',
      'summarize',
    ]

    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
    }

    const result = await aiGateway.compose({
      supabase,
      userId: user.id,
      action,
      text,
      tone,
      targetLanguage,
      ip,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json(error.toJSON(), { status: error.status })
    }
    return handleApiError(error, { context: 'POST /api/ai/compose' })
  }
}
