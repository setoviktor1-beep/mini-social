/**
 * Redaction utility for AI platform.
 * Ensures secrets, API keys, passwords, and sensitive server tokens
 * are never leaked to logs or client responses.
 */

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|secret|token|password|auth|bearer)[\s:=]+([a-zA-Z0-9_\-.]{8,})/gi,
  /sk-[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9_\-.]{20,}/gi,
  /AIza[0-9A-Za-z-_]{35}/g, // Google API key
  /nvapi-[a-zA-Z0-9_\-]{20,}/g, // NVIDIA NIM key
]

export function redactSensitiveData(text: string): string {
  if (!text || typeof text !== 'string') return ''
  let sanitized = text
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      if (match.length <= 8) return '[REDACTED]'
      return match.slice(0, 4) + '...[REDACTED]...' + match.slice(-3)
    })
  }
  return sanitized
}

export function sanitizeUserInput(input: string, maxChars = 6000): string {
  if (!input || typeof input !== 'string') return ''
  // Normalize Unicode and trim whitespace
  const trimmed = input.normalize('NFKC').trim()
  return trimmed.slice(0, maxChars)
}
