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

export function resolveModelSlug(slug: string): string {
  const normalized = (slug || '').trim().toLowerCase()
  if (
    normalized === 'gemini-3.5-flash-lite' ||
    normalized === 'gemini-flash-lite' ||
    normalized === 'google/gemini-3.5-flash-lite' ||
    normalized === 'gemini-2.0-flash-lite' ||
    normalized === 'gemini-2.5-flash-lite'
  ) {
    return 'gemini-3.5-flash-lite'
  }
  if (
    normalized === 'nvidia-nemotron' ||
    normalized === 'nemotron' ||
    normalized === 'nvidia/nemotron'
  ) {
    return 'nvidia/nemotron-3-ultra-550b-a55b:free'
  }
  return slug.trim()
}

export function getOmniRouterConfig() {
  const apiKey =
    process.env.OMNIROUTER_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    ''

  const baseUrl =
    process.env.OMNIROUTER_BASE_URL ||
    'https://openrouter.ai/api/v1'

  const primaryModel = resolveModelSlug(
    process.env.AI_PRIMARY_MODEL || 'gemini-3.5-flash-lite',
  )

  const fallbackModel = resolveModelSlug(
    process.env.AI_FALLBACK_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  )

  const reasoningModel = resolveModelSlug(
    process.env.AI_REASONING_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
  )

  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ''),
    isConfigured: Boolean(apiKey),
    primaryModel,
    fallbackModel,
    reasoningModel,
  }
}

export function getModelConfig(modelId: string): ModelConfig {
  const resolved = resolveModelSlug(modelId)
  const isNemotron = resolved.includes('nemotron')
  const isGemini = resolved.includes('gemini')

  return {
    id: resolved,
    provider: isNemotron ? 'nvidia' : isGemini ? 'google' : 'omnirouter',
    displayName: isNemotron
      ? 'NVIDIA Nemotron (Free)'
      : isGemini
        ? 'Gemini 3.5 Flash-Lite (Free)'
        : resolved,
    maxInputChars: 8000,
    // Nemotron spends max_tokens on internal reasoning trace first; budget generously
    defaultMaxTokens: isNemotron ? 900 : 800,
    defaultTemperature: 0.4,
    timeoutMs: 25_000,
    supportsReasoning: isNemotron,
  }
}
