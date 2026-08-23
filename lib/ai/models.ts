export type AiTaskType =
  | 'chat'
  | 'compose'
  | 'moderation'
  | 'reasoning'
  | 'tools'
  | 'search'
  | 'summary'

export interface ModelConfig {
  id: string
  provider: string
  displayName: string
  maxInputChars: number
  defaultMaxTokens: number
  defaultTemperature: number
  timeoutMs: number
  supportsReasoning?: boolean
}

export function normalizeBaseUrl(url?: string): string {
  if (!url) return ''
  let cleaned = url.trim().replace(/\/+$/, '')
  if (cleaned.endsWith('/chat/completions')) {
    cleaned = cleaned.slice(0, -'/chat/completions'.length).replace(/\/+$/, '')
  }
  return cleaned
}

export function resolveModelSlug(slug: string): string {
  if (!slug || typeof slug !== 'string') return 'nvidia/nemotron-3-ultra-550b-a55b:free'
  const trimmed = slug.trim()
  const normalized = trimmed.toLowerCase()

  if (
    normalized === 'nvidia-nemotron' ||
    normalized === 'nemotron' ||
    normalized === 'nemotron-ultra' ||
    normalized === 'nvidia/nemotron' ||
    normalized === 'nvidia/nemotron-ultra' ||
    normalized === 'nvidia/nemotron-3-ultra-550b-a55b:free'
  ) {
    return 'nvidia/nemotron-3-ultra-550b-a55b:free'
  }

  if (
    normalized === 'gemini-3.5-flash-lite' ||
    normalized === 'gemini-flash-lite' ||
    normalized === 'gemini-flash-ligt' ||
    normalized === 'gemini-3.5-flash-ligt' ||
    normalized === 'google/gemini-3.5-flash-lite' ||
    normalized === 'google/gemini-3.5-flash-ligt' ||
    normalized === 'google/gemini-flash-lite' ||
    normalized === 'gemini-2.5-flash-lite' ||
    normalized === 'google/gemini-2.5-flash-lite'
  ) {
    return 'google/gemini-3.5-flash-lite'
  }

  if (
    normalized === 'gemma' ||
    normalized === 'gemma-4-31b-it' ||
    normalized === 'gemma-4-31b-it:free' ||
    normalized === 'google/gemma-4-31b-it' ||
    normalized === 'google/gemma-4-31b-it:free'
  ) {
    return 'google/gemma-4-31b-it:free'
  }

  return trimmed
}

export function getOmniRouterConfig() {
  const apiKey = (process.env.OMNIROUTER_API_KEY || '').trim()
  const baseUrl = normalizeBaseUrl(process.env.OMNIROUTER_BASE_URL)

  const primaryModel = resolveModelSlug(
    process.env.AI_PRIMARY_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  )

  const fallbackModel = resolveModelSlug(
    process.env.AI_FALLBACK_MODEL || 'google/gemini-3.5-flash-lite',
  )

  const reasoningModel = resolveModelSlug(
    process.env.AI_REASONING_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  )

  const gemmaModel = resolveModelSlug(
    process.env.AI_GEMMA_MODEL || 'google/gemma-4-31b-it:free',
  )

  return {
    apiKey,
    baseUrl,
    isConfigured: Boolean(apiKey && baseUrl),
    primaryModel,
    fallbackModel,
    reasoningModel,
    gemmaModel,
  }
}

export function getModelConfig(modelId: string): ModelConfig {
  const resolved = resolveModelSlug(modelId)
  const isNemotron = resolved.includes('nemotron')
  const isGemini = resolved.includes('gemini')
  const isGemma = resolved.includes('gemma')

  return {
    id: resolved,
    provider: isNemotron ? 'nvidia' : isGemini || isGemma ? 'google' : 'omnirouter',
    displayName: isNemotron
      ? 'NVIDIA Nemotron Ultra (Free)'
      : isGemini
        ? 'Google Gemini 3.5 Flash-Lite'
        : isGemma
          ? 'Google Gemma 4 31B-IT (Free)'
          : resolved,
    maxInputChars: 8000,
    defaultMaxTokens: isNemotron ? 900 : 800,
    defaultTemperature: 0.4,
    timeoutMs: 25_000,
    supportsReasoning: isNemotron,
  }
}
