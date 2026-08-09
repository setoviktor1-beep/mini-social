import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/backend-server'
import { rateLimit } from '@/lib/rate-limit'
import { chatCompletion, isAiConfigured, AiUnavailableError, AiRequestError } from '@/lib/ai/openrouter'
import { handleApiError } from '@/lib/api-error'

export const runtime = 'nodejs'

// Composer AI assist tools. Every action here only ever RETURNS a
// suggestion for the client to show and let the user explicitly apply —
// nothing in this route writes to posts/comments. See docs/ai-composer.md.
type ComposeAction = 'rewrite' | 'tone' | 'translate' | 'spelling' | 'hashtags' | 'summarize'

const MAX_TEXT_LENGTH = 2000 // matches the post content limit

const composeLimiter = rateLimit({ limit: 20, windowMs: 60 * 1000 })

// Monthly quota, reusing the same ai_usage table/RPC the existing Gemini
// Pro-chat feature uses (check_and_increment_ai_usage). Composer AI tools
// are available to every authenticated user, not just Pro/Enterprise, so
// the default limit is intentionally modest.
const MONTHLY_QUOTA = 60

function systemPromptFor(action: ComposeAction, options: { tone?: string; targetLanguage?: string }): string {
  switch (action) {
    case 'rewrite':
      return 'You improve short social-media posts written in Lithuanian or English. Rewrite the given post to be clearer and more engaging while preserving its meaning, language, and length roughly the same. Return only the rewritten post text, nothing else — no quotes, no explanation.'
    case 'tone':
      return `You adjust the tone of a short social-media post to be more "${options.tone || 'friendly'}", while preserving its language, meaning, and roughly the same length. Return only the rewritten post text, nothing else.`
    case 'translate':
      return `Translate the given social-media post into ${options.targetLanguage || 'English'}. Preserve tone and meaning. Return only the translated text, nothing else.`
    case 'spelling':
      return 'Fix only spelling and grammar mistakes in the given text. Do not change wording, tone, or meaning otherwise. Return only the corrected text, nothing else.'
    case 'hashtags':
      return 'Suggest 3-5 relevant, concise hashtags (without the # symbol, space-separated, lowercase) for the given social-media post. Return only the hashtags, nothing else.'
    case 'summarize':
      return 'Summarize the given discussion thread or post in 1-2 short sentences, in the same language as the input. Return only the summary, nothing else.'
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    if (!isAiConfigured()) {
      return NextResponse.json(
        { error: 'AI_UNAVAILABLE', message: 'AI įrankiai šiuo metu nepasiekiami.' },
        { status: 503 },
      )
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'anonymous'
    const limitResult = await composeLimiter.check(`ai-compose:${user.id}:${ip}`)
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfter: limitResult.resetIn },
        { status: 429, headers: { 'Retry-After': String(limitResult.resetIn) } },
      )
    }

    const body = await request.json().catch(() => null)
    const action = body?.action as ComposeAction | undefined
    const text = typeof body?.text === 'string' ? body.text : ''

    const validActions: ComposeAction[] = ['rewrite', 'tone', 'translate', 'spelling', 'hashtags', 'summarize']
    if (!action || !validActions.includes(action)) {
      return NextResponse.json({ error: 'INVALID_ACTION' }, { status: 400 })
    }
    if (!text.trim()) {
      return NextResponse.json({ error: 'MISSING_TEXT' }, { status: 400 })
    }
    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'TEXT_TOO_LONG' }, { status: 400 })
    }

    const { data: allowed, error: quotaError } = await supabase.rpc('check_and_increment_ai_usage', {
      p_user_id: user.id,
      p_limit: MONTHLY_QUOTA,
    })
    if (quotaError) {
      return NextResponse.json({ error: 'QUOTA_CHECK_FAILED' }, { status: 500 })
    }
    if (!allowed) {
      return NextResponse.json(
        { error: 'QUOTA_EXCEEDED', message: 'Pasiekėte mėnesinę AI naudojimo ribą.' },
        { status: 429 },
      )
    }

    const system = systemPromptFor(action, {
      tone: typeof body?.tone === 'string' ? body.tone.slice(0, 50) : undefined,
      targetLanguage: typeof body?.targetLanguage === 'string' ? body.targetLanguage.slice(0, 30) : undefined,
    })

    const { text: suggestion, model } = await chatCompletion({ system, user: text, maxTokens: 300 })

    return NextResponse.json({
      suggestion,
      model,
      // The client must show this as a suggestion requiring explicit
      // confirmation before it touches the composer's actual content —
      // see PostComposer.tsx's AI panel. This flag exists so any future
      // consumer of this endpoint can't mistake it for a direct-publish API.
      requiresConfirmation: true,
    })
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: 'AI_UNAVAILABLE' }, { status: 503 })
    }
    if (error instanceof AiRequestError) {
      return NextResponse.json({ error: 'AI_REQUEST_FAILED' }, { status: 502 })
    }
    return handleApiError(error, { context: 'POST /api/ai/compose' })
  }
}
