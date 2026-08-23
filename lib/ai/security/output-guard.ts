/**
 * P0 AI Output Guard & Leakage Prevention Filter
 * Ensures that reasoning traces, system prompts, tool registry schemas,
 * internal context delimiters, leaked tool calls, and database/auth secrets NEVER reach the frontend or database.
 */

import { sanitizeAssistantOutput } from './sanitize-output'

export interface OutputGuardCheckParams {
  text: string
  userId?: string
  model?: string
  userContextUuids?: string[]
}

export interface OutputGuardResult {
  safe: boolean
  sanitizedText: string
  blockedReason?: string
}

const FORBIDDEN_SECRET_PATTERNS = [
  { name: 'DB_SECRET_LEAK', regex: /(?:postgresql:\/\/|postgres:\/\/|mongodb:\/\/|redis:\/\/)[^\s]+/gi },
  { name: 'SERVICE_ROLE_LEAK', regex: /\b(?:service_role|auth\.uid\(\)|POSTGREST_JWT_SECRET)\b/gi },
  { name: 'API_KEY_LEAK', regex: /\b(?:sk-or-v1-[a-f0-9]{64}|sk-[a-zA-Z0-9_-]{20,})\b/gi },
  { name: 'BEARER_TOKEN_LEAK', regex: /\bBearer\s+eyJ[a-zA-Z0-9_-]{20,}\b/gi },
]

const SYSTEM_PROMPT_LEAK_PATTERNS = [
  { name: 'SYSTEM_PROMPT_HEADER', regex: /(?:=== SYSTEM POLICY ===|=== VARTOTOJO KONTEKSTAS ===|=== PRIEINAMI ĮRANKIAI IR GALIMYBĖS ===|=== GRIEŽTOS PRIVATUMO IR SAUGUMO TAISYKLĖS ===|=== GRIEŽTOS ĮRANKIŲ IR ATSAKYMŲ TAISYKLĖS ===)/gi },
  { name: 'SYSTEM_PROMPT_LABEL', regex: /\b(?:SYSTEM PROMPT|SYSTEM PREAMBLE|DEVELOPER MESSAGE|INTERNAL INSTRUCTIONS)\b/gi },
  { name: 'TOOL_SCHEMA_LEAK', regex: /\b(?:available tools:|tool list:|tool registry:|ALLOWED_TOOLS_DEFINITIONS)\b/gi },
]

/**
 * Sanitizes and validates AI model output before it is saved or returned to client.
 */
export function validateAndSanitizeAiOutput(params: OutputGuardCheckParams): OutputGuardResult {
  let text = (params.text || '').trim()
  if (!text) {
    return { safe: true, sanitizedText: '' }
  }

  // 1. Check for critical secret leaks (API keys, DB connection strings, bearer tokens)
  for (const forbidden of FORBIDDEN_SECRET_PATTERNS) {
    if (forbidden.regex.test(text)) {
      console.error(`[AI Security] AI_OUTPUT_BLOCKED reason=${forbidden.name} model=${params.model || 'unknown'}`)
      return {
        safe: false,
        sanitizedText: '',
        blockedReason: `Aptiktas jautrių duomenų nutekėjimas (${forbidden.name})`,
      }
    }
  }

  // 2. Comprehensive tool/thinking/delimiter sanitation
  text = sanitizeAssistantOutput(text)

  // 3. Strip any leaked internal prompt headers/labels
  for (const forbidden of SYSTEM_PROMPT_LEAK_PATTERNS) {
    text = text.replace(forbidden.regex, '').trim()
  }

  // 4. Scrub server context UUIDs if present in output text
  if (params.userId) {
    text = text.replaceAll(params.userId, '[CURRENT_USER]')
  }
  if (params.userContextUuids) {
    for (const uuid of params.userContextUuids) {
      if (uuid && uuid.length > 10) {
        text = text.replaceAll(uuid, '[REDACTED_UUID]')
      }
    }
  }

  // 5. Final check: if text is empty after removing thinking/system prompt/tool calls
  if (!text || text.length < 2) {
    return {
      safe: false,
      sanitizedText: '',
      blockedReason: 'AI atsakymas buvo tuščias pašalinus vidinius mąstymo ir įrankių blokus',
    }
  }

  return {
    safe: true,
    sanitizedText: text,
  }
}
