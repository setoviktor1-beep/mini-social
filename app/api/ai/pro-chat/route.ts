import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/backend-server'
import { aiGateway } from '@/lib/ai/gateway'
import { handleApiError } from '@/lib/api-error'
import { AiError } from '@/lib/ai/errors'

export const runtime = 'nodejs'

const AI_LIMITS: Record<string, number> = {
  basic: 30,
  pro: 100,
  enterprise: 500,
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check subscription plan
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()

    const plan = sub?.plan || 'basic'
    const isActive = sub?.status === 'active' || sub?.status === 'trialing' || plan === 'basic'

    if (!isActive) {
      return NextResponse.json(
        {
          error: 'SUBSCRIPTION_REQUIRED',
          message: 'Aktyvi prenumerata privaloma naudoti AI asistentą.',
        },
        { status: 403 },
      )
    }

    const limit = AI_LIMITS[plan] || 30

    const { data: allowed } = await supabase.rpc('check_and_increment_ai_usage', {
      p_user_id: user.id,
      p_limit: limit,
    })

    if (allowed === false) {
      return NextResponse.json(
        {
          error: 'LIMIT_REACHED',
          message: `Pasiektas mėnesio limitas (${limit} žinutės). Limitas atsinaujins kitą mėnesį.`,
        },
        { status: 429 },
      )
    }

    const body = await request.json().catch(() => null)
    const message = typeof body?.message === 'string' ? body.message : ''
    const threadId = typeof body?.threadId === 'string' ? body.threadId : undefined

    // Note: Any client-provided `history` is intentionally IGNORED for P0 security.
    // History is loaded securely from the database by aiGateway.

    if (!message.trim()) {
      return NextResponse.json({ error: 'EMPTY_MESSAGE', message: 'Žinutė tuščia' }, { status: 400 })
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
      includeBusiness: true,
    })

    const currentMonth = new Date().toISOString().slice(0, 7)
    const { data: usage } = await supabase
      .from('ai_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .maybeSingle()

    return NextResponse.json({
      reply: result.reply,
      threadId: result.threadId,
      model: result.model,
      provider: result.provider,
      usage: { used: usage?.count || 1, limit },
    })
  } catch (error) {
    if (error instanceof AiError) {
      return NextResponse.json(error.toJSON(), { status: error.status })
    }
    return handleApiError(error, { context: 'POST /api/ai/pro-chat' })
  }
}
