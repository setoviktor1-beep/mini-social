import { AiError } from './errors'
import { getOmniRouterConfig, resolveModelSlug, AiTaskType } from './models'
import { callOmniRouter, OmniMessage, OmniRouterResponse, OpenAiToolDefinition } from './omnirouter'

export interface RouteRequestOptions {
  task: AiTaskType
  messages: OmniMessage[]
  maxTokens?: number
  temperature?: number
  isPrivate?: boolean
  model?: string
  tools?: OpenAiToolDefinition[]
  toolChoice?: 'auto' | 'none'
}

export async function routeAiRequest(
  options: RouteRequestOptions,
): Promise<OmniRouterResponse> {
  const config = getOmniRouterConfig()
  if (!config.isConfigured) {
    throw new AiError('AI_UNAVAILABLE', 'AI tiekėjas nėra sukonfigūruotas', { status: 503 })
  }

  // Explicit user model selection or model selection based on task intent
  let targetModel: string
  if (options.model) {
    targetModel = resolveModelSlug(options.model)
  } else {
    switch (options.task) {
      case 'reasoning':
        targetModel = config.reasoningModel
        break
      case 'tools':
        targetModel = config.fallbackModel
        break
      case 'chat':
      case 'compose':
      case 'moderation':
      case 'search':
      case 'summary':
      default:
        targetModel = config.primaryModel
        break
    }
  }

  try {
    return await callOmniRouter({
      model: targetModel,
      messages: options.messages,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      isPrivate: options.isPrivate,
      tools: options.tools,
      toolChoice: options.toolChoice,
    })
  } catch (error: unknown) {
    // If primary/selected model fails with transient error (rate limit, provider 5xx, timeout),
    // and fallback model is different, retry with fallback model
    const shouldFallback =
      error instanceof AiError &&
      (error.code === 'AI_RATE_LIMITED' ||
        error.code === 'AI_PROVIDER_ERROR' ||
        error.code === 'AI_TIMEOUT') &&
      targetModel !== config.fallbackModel

    if (shouldFallback) {
      try {
        return await callOmniRouter({
          model: config.fallbackModel,
          messages: options.messages,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          isPrivate: options.isPrivate,
          tools: options.tools,
          toolChoice: options.toolChoice,
        })
      } catch {
        // If fallback also fails, throw the original error or normalized error
        throw error
      }
    }

    throw error
  }
}
