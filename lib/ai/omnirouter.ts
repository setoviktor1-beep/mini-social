import { AiError } from './errors'
import { getOmniRouterConfig, getModelConfig } from './models'

export interface OpenAiFunctionCall {
  name: string
  arguments: string
}

export interface OpenAiToolCall {
  id: string
  type: 'function'
  function: OpenAiFunctionCall
}

export interface OpenAiFunctionDefinition {
  name: string
  description?: string
  parameters?: Record<string, any>
}

export interface OpenAiToolDefinition {
  type: 'function'
  function: OpenAiFunctionDefinition
}

export interface OmniMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: OpenAiToolCall[]
  tool_call_id?: string
  name?: string
}

export interface OmniRouterRequestOptions {
  model?: string
  messages: OmniMessage[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
  isPrivate?: boolean
  tools?: OpenAiToolDefinition[]
  toolChoice?: 'auto' | 'none'
}

export interface OmniRouterResponse {
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

export function isOmniRouterConfigured(): boolean {
  const { isConfigured } = getOmniRouterConfig()
  return isConfigured
}

/**
 * Universal OmniRouter Client
 * All LLM requests across MiniSocial flow strictly through OmniRouter.
 * Supports native OpenAI-compatible function calling (tool_calls).
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

  const url = `${config.baseUrl}/chat/completions`

  const requestBody: Record<string, any> = {
    model,
    messages: options.messages,
    max_tokens: maxTokens,
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

      let host = ''
      try {
        host = new URL(url).host
      } catch {
        host = config.baseUrl
      }

      // Safe structured server log without leaking prompt, memory, or API keys
      console.error(
        `[AI] OmniRouter request failed status=${status} endpoint=${host} model=${model} provider_message=${errorText.slice(0, 300).replace(/[\r\n]+/g, ' ')}`,
      )

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

    // P0: Discard raw provider reasoning, thoughts, scratchpad, analysis fields
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
      // Strip XML/thinking blocks if emitted directly in content
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

    // Valid if content exists OR if tool calls are present
    if (!content && toolCalls.length === 0) {
      if (finishReason === 'length') {
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
      content,
      toolCalls,
      finishReason,
      model: data?.model || model,
      provider: modelInfo.provider,
      usage,
    }
  } catch (err: unknown) {
    if (err instanceof AiError) throw err

    if (err instanceof Error && err.name === 'AbortError') {
      console.error(`[AI] OmniRouter request timed out model=${model} timeoutMs=${timeoutMs}`)
      throw new AiError('AI_TIMEOUT', 'OmniRouter užklausa viršijo leistiną laiką', { status: 504 })
    }

    console.error(`[AI] OmniRouter network/system error model=${model} message=${err instanceof Error ? err.message : String(err)}`)
    throw new AiError('AI_PROVIDER_ERROR', err instanceof Error ? err.message : 'Unknown AI error', {
      status: 502,
    })
  } finally {
    clearTimeout(timer)
  }
}
