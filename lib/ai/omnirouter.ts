import { AiError } from './errors'
import { getOmniRouterConfig, getModelConfig } from './models'

export interface OmniMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OmniRouterRequestOptions {
  model?: string
  messages: OmniMessage[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  isPrivate?: boolean
}

export interface OmniRouterResponse {
  content: string
  model: string
  provider: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export function isOmniRouterConfigured(): boolean {
  const { isConfigured } = getOmniRouterConfig()
  return isConfigured
}

/**
 * Universal OmniRouter Client
 * All LLM requests across MiniSocial flow strictly through OmniRouter.
 * No direct third-party provider calls are made by MiniSocial.
 */
export async function callOmniRouter(
  options: OmniRouterRequestOptions,
): Promise<OmniRouterResponse> {
  const config = getOmniRouterConfig()
  if (!config.isConfigured) {
    throw new AiError('AI_UNAVAILABLE', 'AI tiekėjas (OmniRouter) nėra sukonfigūruotas', { status: 503 })
  }

  const model = options.model || config.primaryModel
  const modelInfo = getModelConfig(model)
  const timeoutMs = options.timeoutMs ?? modelInfo.timeoutMs
  const maxTokens = options.maxTokens ?? modelInfo.defaultMaxTokens
  const temperature = options.temperature ?? modelInfo.defaultTemperature
  // All user-facing AI interactions are strictly private by default
  const isPrivate = options.isPrivate ?? true

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
    'HTTP-Referer': process.env.APP_URL || 'https://mini-social.online',
    'X-Title': 'Mini Social',
  }

  // P0 Privacy: Disable shared semantic cache for all private requests
  if (isPrivate) {
    headers['X-OmniRoute-No-Cache'] = '1'
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `${config.baseUrl}/chat/completions`
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: options.messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const status = response.status

      if (status === 401 || status === 403) {
        throw new AiError(
          'AI_UNAVAILABLE',
          'OmniRouter autentifikacijos klaida',
          { status: 502, details: errorText.slice(0, 200) },
        )
      }
      if (status === 429) {
        throw new AiError(
          'AI_RATE_LIMITED',
          'OmniRouter limitas viršytas (429)',
          { status: 429, details: errorText.slice(0, 200) },
        )
      }
      if (status >= 500) {
        throw new AiError(
          'AI_PROVIDER_ERROR',
          `OmniRouter klaida: ${status}`,
          { status: 502, details: errorText.slice(0, 200) },
        )
      }

      throw new AiError(
        'AI_INVALID_REQUEST',
        `OmniRouter užklausos klaida: ${status}`,
        { status, details: errorText.slice(0, 200) },
      )
    }

    const data = await response.json()
    const choice = data?.choices?.[0]
    const content = choice?.message?.content

    if (typeof content !== 'string' || !content.trim()) {
      if (choice?.finish_reason === 'length') {
        throw new AiError(
          'AI_PROVIDER_ERROR',
          'AI atsakymas buvo sutrumpintas dėl tokenų limito',
          { status: 502 },
        )
      }
      throw new AiError('AI_PROVIDER_ERROR', 'OmniRouter grąžino tuščią atsakymą', { status: 502 })
    }

    const usage = {
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens: data?.usage?.total_tokens ?? 0,
    }

    return {
      content: content.trim(),
      model: data?.model || model,
      provider: modelInfo.provider,
      usage,
    }
  } catch (err: unknown) {
    if (err instanceof AiError) throw err

    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiError('AI_TIMEOUT', 'OmniRouter užklausa viršijo leistiną laiką', { status: 504 })
    }

    throw new AiError('AI_PROVIDER_ERROR', err instanceof Error ? err.message : 'Unknown AI error', {
      status: 502,
    })
  } finally {
    clearTimeout(timer)
  }
}
