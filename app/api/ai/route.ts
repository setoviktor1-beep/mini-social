import { NextResponse } from 'next/server'
import { calcCostEUR, parsePricePer1K } from '@/lib/pricing'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type AIFeature = 'improve_post' | 'generate_reply' | 'toxicity_gate'

interface AIRequestBody {
  feature?: AIFeature
  text?: string
  context?: string
}

const MODEL = 'gemini-2.5-flash-lite'
const MAX_OUTPUT_TOKENS = 384

function buildPrompt(feature: AIFeature, text: string, context?: string): string {
  if (feature === 'improve_post') {
    return [
      'Rewrite the user text to be clearer and more engaging.',
      'Keep original meaning.',
      'Output only rewritten text, no explanations.',
      '',
      `TEXT:\n${text}`,
    ].join('\n')
  }

  if (feature === 'generate_reply') {
    return [
      'Write one short helpful social reply.',
      'Output only the reply text.',
      '',
      context ? `CONTEXT:\n${context}\n` : '',
      `POST:\n${text}`,
    ].join('\n')
  }

  return [
    'Classify toxicity of the text.',
    'Return STRICT JSON object with keys: ok(boolean), reason(string), suggestion(string).',
    'If text is safe: ok=true and empty reason/suggestion.',
    'If toxic: ok=false with short reason and safer rewrite suggestion.',
    '',
    `TEXT:\n${text}`,
  ].join('\n')
}

async function countTokens(apiKey: string, prompt: string): Promise<number> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:countTokens?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      }),
    }
  )
  if (!res.ok) return 0
  const json = await res.json()
  return Number(json?.totalTokens || 0) || 0
}

function extractResponseText(json: any): string {
  const parts = json?.candidates?.[0]?.content?.parts || []
  return parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n')
    .trim()
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as AIRequestBody | null
    const feature = body?.feature
    const text = (body?.text || '').trim()
    const context = (body?.context || '').trim()

    if (!feature || !['improve_post', 'generate_reply', 'toxicity_gate'].includes(feature)) {
      return NextResponse.json({ error: 'INVALID_FEATURE' }, { status: 400 })
    }
    if (!text) {
      return NextResponse.json({ error: 'TEXT_REQUIRED' }, { status: 400 })
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: 'PROFILE_NOT_FOUND' }, { status: 400 })
    }
    if (Number(profile.balance || 0) <= 0) {
      return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 402 })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY_MISSING' }, { status: 500 })
    }

    const prompt = buildPrompt(feature, text, context)
    const genRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: feature === 'toxicity_gate' ? 0.1 : 0.6,
          },
        }),
      }
    )

    if (!genRes.ok) {
      const msg = await genRes.text()
      return NextResponse.json({ error: 'AI_PROVIDER_ERROR', details: msg }, { status: 502 })
    }

    const genJson = await genRes.json()
    const outputText = extractResponseText(genJson)

    const usage = genJson?.usageMetadata || {}
    let tokensIn = Number(usage.promptTokenCount || 0) || 0
    let tokensOut = Number(usage.candidatesTokenCount || 0) || 0

    if (tokensIn <= 0) {
      tokensIn = await countTokens(apiKey, prompt)
    }
    if (tokensOut <= 0) {
      tokensOut = MAX_OUTPUT_TOKENS
    }

    const pricePer1K = parsePricePer1K()
    const cost = calcCostEUR(tokensIn, tokensOut, pricePer1K)

    const serviceClient = createSupabaseServiceClient()
    const { data: balanceAfterCharge, error: chargeError } = await serviceClient.rpc('charge_ai_usage', {
      p_user_id: user.id,
      p_feature: feature,
      p_model: MODEL,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_cost: cost,
    })

    if (chargeError) {
      const message = String(chargeError.message || '')
      if (message.includes('INSUFFICIENT_BALANCE')) {
        return NextResponse.json({ error: 'INSUFFICIENT_BALANCE' }, { status: 402 })
      }
      return NextResponse.json({ error: 'CHARGE_FAILED' }, { status: 500 })
    }

    if (feature === 'toxicity_gate') {
      let parsed: any = null
      try {
        parsed = JSON.parse(outputText)
      } catch {}
      if (!parsed || typeof parsed.ok !== 'boolean') {
        return NextResponse.json(
          { ok: true, reason: '', suggestion: '', balance: balanceAfterCharge, cost, tokens_input: tokensIn, tokens_output: tokensOut },
          { status: 200 }
        )
      }
      return NextResponse.json({
        ok: parsed.ok,
        reason: String(parsed.reason || ''),
        suggestion: String(parsed.suggestion || ''),
        balance: balanceAfterCharge,
        cost,
        tokens_input: tokensIn,
        tokens_output: tokensOut,
      })
    }

    return NextResponse.json({
      text: outputText,
      balance: balanceAfterCharge,
      cost,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
    })
  } catch {
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

