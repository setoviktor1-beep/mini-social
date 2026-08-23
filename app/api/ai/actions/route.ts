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
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const actionType = body?.actionType
    const input = typeof body?.input === 'string' ? body.input : ''

    const validActions = [
      'summarize_feed',
      'draft_reply',
      'explain_post',
      'improve_bio',
      'search_assist',
    ]

    if (!actionType || !validActions.includes(actionType)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
    }

    if (!input.trim()) {
      return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Trūksta teksto' }, { status: 400 })
    }

    const result = await aiGateway.action({
      actionType,
      input,
      userId: user.id,
      supabase,
      contextData: body?.contextData,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json(error.toJSON(), { status: error.status })
    }
    return handleApiError(error, { context: 'POST /api/ai/actions' })
  }
}
