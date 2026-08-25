import { AiError } from './errors'
import { getModelConfig, normalizeBaseUrl, resolveModelSlug } from './models'
import { OmniMessage, OpenAiToolCall, OpenAiToolDefinition } from './omnirouter'

export interface OpenClawRequestOptions {
  userId: string
  threadId: string
  messages: OmniMessage[]
  tools?: OpenAiToolDefinition[]
  toolChoice?: 'auto' | 'none'
  model?: string
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  isPrivate?: boolean
}

export interface OpenClawResponse {
  content: string | null
  toolCalls: OpenAiToolCall[]
  finishReason?: string
  model: string
  provider: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export function getOpenClawConfig() {
  const rawUrl =
    process.env.OPENCLAW_INTERNAL_URL ||
    process.env.OPENCLAW_URL ||
    'http://mini-social-openclaw:18789'
  const url = normalizeBaseUrl(rawUrl)
  const token = (
    process.env.MINISOCIAL_AGENT_INTERNAL_SECRET ||
    process.env.OPENCLAW_GATEWAY_TOKEN ||
    ''
  ).trim()
  const backendMode = (process.env.AI_AGENT_BACKEND || '').trim().toLowerCase()
  const enabled =
    backendMode === 'openclaw' ||
    (backendMode !== 'legacy' && process.env.AI_OPENCLAW_ENABLED !== 'false')

  return {
    url,
    token,
    enabled,
    isConfigured: Boolean(url && token),
  }
}

export function isOpenClawEnabled(): boolean {
  const config = getOpenClawConfig()
  return config.enabled && config.isConfigured
}

export function buildOpenClawSessionKey(userId: string, threadId: string): string {
  const safeUser = (userId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeThread = (threadId || '').trim().replace(/[^a-zA-Z0-9_-]/g, '_')
  return `minisocial:${safeUser}:${safeThread}`
}

/**
 * Universal OpenClaw Client
 * Communicates with the dedicated mini-social-openclaw container via internal network.
 * Enforces per-user session isolation and native OpenAI-compatible tool calling.
 */
export async function callOpenClaw(
  options: OpenClawRequestOptions,
): Promise<OpenClawResponse> {
  const config = getOpenClawConfig()
  if (!config.isConfigured) {
    throw new AiError('AI_UNAVAILABLE', 'AI asistento paslauga šiuo metu nepasiekiama.', { status: 503 })
  }

  const { userId, threadId } = options
  if (!userId || typeof userId !== 'string') {
    throw new AiError('AI_INVALID_REQUEST', 'Vartotojo ID privalomas užklausai.', { status: 400 })
  }

  const sessionKey = buildOpenClawSessionKey(userId, threadId)
  const requestedModel = options.model ? resolveModelSlug(options.model) : undefined
  const modelInfo = getModelConfig(requestedModel || 'nvidia/nemotron-3-ultra-550b-a55b:free')
  const timeoutMs = options.timeoutMs ?? modelInfo.timeoutMs ?? 30_000
  const maxTokens = options.maxTokens ?? modelInfo.defaultMaxTokens ?? 900
  const temperature = options.temperature ?? modelInfo.defaultTemperature ?? 0.4

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.token}`,
    'x-openclaw-session-key': sessionKey,
    'x-openclaw-message-channel': 'minisocial',
  }

  if (requestedModel) {
    headers['x-openclaw-model'] = requestedModel
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const url = `${config.url}/v1/chat/completions`

  const requestBody: Record<string, any> = {
    model: 'openclaw/default',
    user: sessionKey,
    messages: options.messages,
    max_completion_tokens: maxTokens,
    temperature,
  }

  if (options.tools && options.tools.length > 0) {
    requestBody.tools = options.tools
    requestBody.tool_choice = options.toolChoice || 'auto'
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const status = response.status

      // Structured server log without exposing tokens or private conversation content
      console.error(
        `[MiniSocial AI Internal] Request failed status=${status} session=${sessionKey} error_sample=${errorText.slice(0, 200).replace(/[\r\n]+/g, ' ')}`,
      )

      if (status === 401 || status === 403) {
        throw new AiError(
          'AI_UNAVAILABLE',
          'AI paslauga šiuo metu nepasiekiama.',
          { status: 503 },
        )
      }
      if (status === 429) {
        throw new AiError(
          'AI_RATE_LIMITED',
          'AI užklausų limitas viršytas. Bandykite po kelių akimirkų.',
          { status: 429 },
        )
      }
      if (status >= 500) {
        throw new AiError(
          'AI_PROVIDER_ERROR',
          'MiniSocial AI šiuo metu nepasiekiamas. Pabandykite dar kartą po kelių akimirkų.',
          { status: 503 },
        )
      }

      throw new AiError(
        'AI_INVALID_REQUEST',
        'AI užklausos vykdymo klaida.',
        { status },
      )
    }

    const data = await response.json()
    const choice = data?.choices?.[0]

    // Discard any raw internal reasoning or thought traces
    if (choice) {
      delete (choice as any).reasoning
      delete (choice as any).reasoning_content
      delete (choice as any).analysis
      delete (choice as any).thinking
      delete (choice as any).thoughts
      delete (choice as any).internal
      if (choice.message) {
        delete (choice.message as any).reasoning
        delete (choice.message as any).reasoning_content
        delete (choice.message as any).analysis
        delete (choice.message as any).thinking
        delete (choice.message as any).thoughts
        delete (choice.message as any).internal
      }
    }

    let content: string | null = choice?.message?.content
    if (typeof content === 'string') {
      content = content
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
        .trim()
      if (!content) {
        content = null
      }
    } else {
      content = null
    }

    const rawToolCalls = choice?.message?.tool_calls
    const toolCalls: OpenAiToolCall[] = Array.isArray(rawToolCalls)
      ? rawToolCalls
          .filter(
            (tc: any) =>
              tc &&
              typeof tc.id === 'string' &&
              tc.function &&
              typeof tc.function.name === 'string',
          )
          .map((tc: any) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.function.name.trim(),
              arguments:
                typeof tc.function.arguments === 'string'
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments || {}),
            },
          }))
      : []

    const finishReason = choice?.finish_reason

    if (!content && toolCalls.length === 0) {
      if (finishReason === 'length') {
        throw new AiError(
          'AI_PROVIDER_ERROR',
          'AI atsakymas buvo sutrumpintas dėl tokenų limito.',
          { status: 502 },
        )
      }
      throw new AiError('AI_PROVIDER_ERROR', 'AI asistentas grąžino tuščią atsakymą.', { status: 502 })
    }

    const usage = {
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens: data?.usage?.total_tokens ?? 0,
    }

    return {
      content,
      toolCalls,
      finishReason,
      model: 'MiniSocial AI',
      provider: 'MiniSocial',
      usage,
    }
  } catch (err: unknown) {
    if (err instanceof AiError) throw err

    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[MiniSocial AI] Request timed out session=${sessionKey} timeoutMs=${timeoutMs}`)
      throw new AiError('AI_TIMEOUT', 'AI užklausa viršijo leistiną laiką.', { status: 504 })
    }

    console.error(
      `[MiniSocial AI] Network error session=${sessionKey} message=${err instanceof Error ? err.message : String(err)}`,
    )
    throw new AiError('AI_UNAVAILABLE', 'MiniSocial AI šiuo metu nepasiekiamas. Pabandykite dar kartą po kelių akimirkų.', {
      status: 503,
    })
  } finally {
    clearTimeout(timer)
  }
}
