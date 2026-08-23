export type AiErrorCode =
  | 'AI_UNAVAILABLE'
  | 'AI_RATE_LIMITED'
  | 'AI_PROVIDER_ERROR'
  | 'AI_TIMEOUT'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_INVALID_REQUEST'
  | 'AI_FORBIDDEN'
  | 'AI_NOT_FOUND'
  | 'AI_INTERNAL_ERROR'

export class AiError extends Error {
  readonly code: AiErrorCode
  readonly status: number
  readonly userMessage: string
  readonly details?: unknown

  constructor(
    code: AiErrorCode,
    message: string,
    options?: { status?: number; userMessage?: string; details?: unknown },
  ) {
    super(message)
    this.name = 'AiError'
    this.code = code
    this.status = options?.status ?? defaultStatusForCode(code)
    this.userMessage = options?.userMessage ?? defaultUserMessage(code)
    this.details = options?.details
  }

  toJSON() {
    return {
      error: this.code,
      message: this.userMessage,
    }
  }
}

function defaultStatusForCode(code: AiErrorCode): number {
  switch (code) {
    case 'AI_UNAVAILABLE':
      return 503
    case 'AI_RATE_LIMITED':
    case 'AI_QUOTA_EXCEEDED':
      return 429
    case 'AI_FORBIDDEN':
      return 403
    case 'AI_NOT_FOUND':
      return 404
    case 'AI_INVALID_REQUEST':
      return 400
    case 'AI_TIMEOUT':
      return 504
    case 'AI_PROVIDER_ERROR':
      return 502
    case 'AI_INTERNAL_ERROR':
    default:
      return 500
  }
}

function defaultUserMessage(code: AiErrorCode): string {
  switch (code) {
    case 'AI_UNAVAILABLE':
      return 'AI paslauga šiuo metu nepasiekiama.'
    case 'AI_RATE_LIMITED':
      return 'Per daug užklausų. Bandykite šiek tiek vėliau.'
    case 'AI_QUOTA_EXCEEDED':
      return 'Pasiektas AI naudojimo limitas.'
    case 'AI_FORBIDDEN':
      return 'Neturite prieigos prie šio AI resurso.'
    case 'AI_NOT_FOUND':
      return 'Pokalbis arba resursas nerastas.'
    case 'AI_INVALID_REQUEST':
      return 'Neteisinga užklausa.'
    case 'AI_TIMEOUT':
      return 'AI užklausa užtruko per ilgai. Bandykite dar kartą.'
    case 'AI_PROVIDER_ERROR':
      return 'Klaida bendraujant su AI tiekėju.'
    case 'AI_INTERNAL_ERROR':
    default:
      return 'Įvyko vidinė klaida apdorojant AI užklausą.'
  }
}

export function toNormalizedAiError(err: unknown): AiError {
  if (err instanceof AiError) return err

  if (err instanceof Error) {
    if (err.name === 'AbortError' || err.message.toLowerCase().includes('timeout')) {
      return new AiError('AI_TIMEOUT', err.message)
    }
    if (err.message.includes('429') || err.message.toLowerCase().includes('rate limit')) {
      return new AiError('AI_RATE_LIMITED', err.message)
    }
    if (err.message.includes('quota') || err.message.toLowerCase().includes('limit reached')) {
      return new AiError('AI_QUOTA_EXCEEDED', err.message)
    }
    return new AiError('AI_PROVIDER_ERROR', err.message)
  }

  return new AiError('AI_INTERNAL_ERROR', 'Unknown AI error')
}
