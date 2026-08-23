import { AiError } from './errors'
import { getOmniRouterConfig, getModelConfig, resolveModelSlug } from './models'

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
 * Direct Google Gemini API execution (free tier models like gemini-3.5-flash-lite)
 */
async function callGeminiDirect(
  options: OmniRouterRequestOptions,
  geminiKey: string,
  model: string,
): Promise<OmniRouterResponse> {
  const modelInfo = getModelConfig(model)
  const timeoutMs = options.timeoutMs ?? modelInfo.timeoutMs
  const maxTokens = options.maxTokens ?? modelInfo.defaultMaxTokens
  const temperature = options.temperature ?? modelInfo.defaultTemperature

  const systemMsg = options.messages.find((m) => m.role === 'system')
  const chatMessages = options.messages.filter((m) => m.role !== 'system')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(systemMsg ? { systemInstruction: { parts: [{ text: systemMsg.content }] } } : {}),
        contents: chatMessages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature,
        },
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (response.status === 429) {
        throw new AiError('AI_RATE_LIMITED', 'Gemini limitas viršytas (429)', { status: 429, details: errorText })
      }
      throw new AiError('AI_PROVIDER_ERROR', `Gemini API klaida: ${response.status}`, {
        status: response.status >= 500 ? 502 : response.status,
        details: errorText,
      })
    }

    const data = await response.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
    if (typeof text !== 'string' || !text.trim()) {
      throw new AiError('AI_PROVIDER_ERROR', 'Gemini grąžino tuščią atsakymą', { status: 502 })
    }

    return {
      content: text.trim(),
      model,
      provider: 'google',
      usage: {
        promptTokens: data?.usageMetadata?.promptTokenCount ?? 0,
        completionTokens: data?.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: data?.usageMetadata?.totalTokenCount ?? 0,
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Direct Mistral API execution (free tier models like ministral-3b-latest / mistral-small-latest)
 */
async function callMistralDirect(
  options: OmniRouterRequestOptions,
  mistralKey: string,
  model: string,
): Promise<OmniRouterResponse> {
  const modelInfo = getModelConfig(model)
  const timeoutMs = options.timeoutMs ?? modelInfo.timeoutMs
  const maxTokens = options.maxTokens ?? modelInfo.defaultMaxTokens
  const temperature = options.temperature ?? modelInfo.defaultTemperature

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = 'https://api.mistral.ai/v1/chat/completions'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${mistralKey}`,
      },
      body: JSON.stringify({
        model: model.includes('mistral') ? model : 'ministral-3b-latest',
        messages: options.messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (response.status === 429) {
        throw new AiError('AI_RATE_LIMITED', 'Mistral limitas viršytas (429)', { status: 429, details: errorText })
      }
      throw new AiError('AI_PROVIDER_ERROR', `Mistral API klaida: ${response.status}`, {
        status: response.status >= 500 ? 502 : response.status,
        details: errorText,
      })
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      throw new AiError('AI_PROVIDER_ERROR', 'Mistral grąžino tuščią atsakymą', { status: 502 })
    }

    return {
      content: text.trim(),
      model: data?.model || model,
      provider: 'mistral',
      usage: {
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Direct NVIDIA NIM execution (free tier models like meta/llama-3.1-8b-instruct)
 */
async function callNvidiaDirect(
  options: OmniRouterRequestOptions,
  nvidiaKey: string,
  model: string,
): Promise<OmniRouterResponse> {
  const modelInfo = getModelConfig(model)
  const timeoutMs = options.timeoutMs ?? modelInfo.timeoutMs
  const maxTokens = options.maxTokens ?? modelInfo.defaultMaxTokens
  const temperature = options.temperature ?? modelInfo.defaultTemperature

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const url = 'https://integrate.api.nvidia.com/v1/chat/completions'
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${nvidiaKey}`,
      },
      body: JSON.stringify({
        model: model.includes('llama') || model.includes('meta') ? model : 'meta/llama-3.1-8b-instruct',
        messages: options.messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      if (response.status === 429) {
        throw new AiError('AI_RATE_LIMITED', 'NVIDIA NIM limitas viršytas (429)', { status: 429, details: errorText })
      }
      throw new AiError('AI_PROVIDER_ERROR', `NVIDIA NIM API klaida: ${response.status}`, {
        status: response.status >= 500 ? 502 : response.status,
        details: errorText,
      })
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      throw new AiError('AI_PROVIDER_ERROR', 'NVIDIA NIM grąžino tuščią atsakymą', { status: 502 })
    }

    return {
      content: text.trim(),
      model: data?.model || model,
      provider: 'nvidia',
      usage: {
        promptTokens: data?.usage?.prompt_tokens ?? 0,
        completionTokens: data?.usage?.completion_tokens ?? 0,
        totalTokens: data?.usage?.total_tokens ?? 0,
      },
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Universal OmniRouter / OpenRouter Gateway Call with multi-provider routing and fallback
 */
export async function callOmniRouter(
  options: OmniRouterRequestOptions,
): Promise<OmniRouterResponse> {
  const config = getOmniRouterConfig()
  if (!config.isConfigured) {
    throw new AiError('AI_UNAVAILABLE', 'AI tiekėjas nėra sukonfigūruotas', { status: 503 })
  }

  const rawModel = options.model || config.primaryModel
  const model = resolveModelSlug(rawModel)

  // Route 1: Direct Google Gemini API (gemini-3.5-flash-lite)
  if (model.startsWith('gemini') && config.geminiKey) {
    try {
      return await callGeminiDirect(options, config.geminiKey, model)
    } catch (err) {
      // If Gemini direct call fails with 429 or 5xx, continue to fallback below
      if (err instanceof AiError && err.status !== 429 && err.status < 500) {
        throw err
      }
    }
  }

  // Route 2: Direct Mistral API (ministral-3b-latest / mistral-small-latest)
  if (model.startsWith('ministral') || model.startsWith('mistral')) {
    if (config.mistralKey) {
      try {
        return await callMistralDirect(options, config.mistralKey, model)
      } catch (err) {
        if (err instanceof AiError && err.status !== 429 && err.status < 500) {
          throw err
        }
      }
    }
  }

  // Route 3: Direct NVIDIA NIM API
  if (model.startsWith('meta/') || model.includes('llama')) {
    if (config.nvidiaKey) {
      try {
        return await callNvidiaDirect(options, config.nvidiaKey, model)
      } catch (err) {
        if (err instanceof AiError && err.status !== 429 && err.status < 500) {
          throw err
        }
      }
    }
  }

  // Route 4: OpenRouter / OmniRouter Free Tier Endpoint
  const isDirectOpenRouter = config.baseUrl.includes('openrouter.ai')
  const routerApiKey = isDirectOpenRouter
    ? (config.openRouterKey || config.omniRouterKey || config.apiKey)
    : (config.omniRouterKey || config.openRouterKey || config.apiKey)
  const routerModel = model.endsWith(':free') ? model : config.fallbackModel

  const modelInfo = getModelConfig(routerModel)
  const timeoutMs = options.timeoutMs ?? modelInfo.timeoutMs
  const maxTokens = options.maxTokens ?? modelInfo.defaultMaxTokens
  const temperature = options.temperature ?? modelInfo.defaultTemperature
  const isPrivate = options.isPrivate ?? true

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${routerApiKey}`,
    'HTTP-Referer': process.env.APP_URL || 'https://mini-social.online',
    'X-Title': 'Mini Social',
  }

  // P0 Privacy: For private AI interactions, completely disable shared semantic caching
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
        model: routerModel,
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
          'AI tiekėjo autentifikacijos klaida',
          { status: 502, details: errorText.slice(0, 200) },
        )
      }
      if (status === 429) {
        throw new AiError(
          'AI_RATE_LIMITED',
          'AI tiekėjo limitas viršytas (429)',
          { status: 429, details: errorText.slice(0, 200) },
        )
      }
      if (status >= 500) {
        throw new AiError(
          'AI_PROVIDER_ERROR',
          `AI tiekėjo klaida: ${status}`,
          { status: 502, details: errorText.slice(0, 200) },
        )
      }

      throw new AiError(
        'AI_INVALID_REQUEST',
        `AI užklausos klaida: ${status}`,
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
      throw new AiError('AI_PROVIDER_ERROR', 'AI tiekėjas grąžino tuščią atsakymą', { status: 502 })
    }

    const usage = {
      promptTokens: data?.usage?.prompt_tokens ?? 0,
      completionTokens: data?.usage?.completion_tokens ?? 0,
      totalTokens: data?.usage?.total_tokens ?? 0,
    }

    return {
      content: content.trim(),
      model: data?.model || routerModel,
      provider: modelInfo.provider,
      usage,
    }
  } catch (err: unknown) {
    if (err instanceof AiError) throw err

    if (err instanceof Error && err.name === 'AbortError') {
      throw new AiError('AI_TIMEOUT', 'AI užklausa viršijo leistiną laiką', { status: 504 })
    }

    throw new AiError('AI_PROVIDER_ERROR', err instanceof Error ? err.message : 'Unknown AI error', {
      status: 502,
    })
  } finally {
    clearTimeout(timer)
  }
}
