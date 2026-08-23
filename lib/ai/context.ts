import { assertValidUserId, verifyOrGetThreadOwnership } from './security/isolation'
import { SYSTEM_SECURITY_PREAMBLE, formatUntrustedUserContent } from './security/prompt-injection'
import { getUserMemory, formatMemoryForPrompt } from './memory'
import { getMyBusinessStats } from './tools/business'
import { OmniMessage } from './omnirouter'

export const MAX_CONTEXT_MESSAGES = 20
export const MAX_CONTEXT_TOKENS = 6000

function estimateTokens(text: string): number {
  return Math.ceil((text || '').length / 4)
}

export interface BuildContextParams {
  supabase: any
  userId: string
  threadId: string
  newMessage: string
  systemPromptOverride?: string
  includeBusiness?: boolean
}

export interface BuiltContextResult {
  threadId: string
  messages: OmniMessage[]
  estimatedTokens: number
  userMemory: Record<string, string>
}

export async function buildServerContext(
  params: BuildContextParams,
): Promise<BuiltContextResult> {
  const {
    supabase,
    userId,
    threadId,
    newMessage,
    systemPromptOverride,
    includeBusiness = false,
  } = params

  assertValidUserId(userId)

  // 1. Verify thread ownership (P0 security check)
  const thread = await verifyOrGetThreadOwnership({
    supabase,
    userId,
    threadId,
  })

  // 2. Fetch history from DB (NEVER from client)
  const { data: dbMessages, error: historyError } = await supabase
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', thread.threadId)
    .order('created_at', { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES)

  if (historyError) {
    throw new Error(`Nepavyko gauti pokalbio istorijos: ${historyError.message}`)
  }

  // Reverse so older messages come first
  const history = (dbMessages || []).slice().reverse()

  // 3. Fetch user profile + memory in parallel
  const [profileResult, userMemory] = await Promise.all([
    supabase
      .from('profiles')
      .select('username, display_name, role')
      .eq('id', userId)
      .maybeSingle(),
    getUserMemory(userId, supabase),
  ])

  const username = profileResult?.data?.username || 'vartotojas'
  const displayName = profileResult?.data?.display_name || username

  // 4. Optionally fetch business context if requested
  let businessSection = ''
  if (includeBusiness) {
    const stats = await getMyBusinessStats(userId, supabase)
    businessSection = `\n=== VARTOTOJO VERSLO DUOMENYS ===
- Užsakymai šį mėnesį: ${stats.thisMonthOrdersCount}
- Pajamos šį mėnesį: €${stats.thisMonthRevenue.toFixed(2)}
- Pajamos praėjusį mėnesį: €${stats.lastMonthRevenue.toFixed(2)}
- Aktyvių paslaugų skaičius: ${stats.activeServicesCount}`
  }

  const memorySection = formatMemoryForPrompt(userMemory)

  // 5. Construct secure system prompt
  const systemPrompt = [
    SYSTEM_SECURITY_PREAMBLE,
    `\n=== VARTOTOJO KONTEKSTAS ===
- Dabartinis vartotojas: @${username} (${displayName})
- Vartotojo ID: ${userId}`,
    businessSection,
    memorySection ? `\n${memorySection}` : '',
    systemPromptOverride
      ? `\n=== UŽDUOTIES INSTRUKCIJA ===\n${systemPromptOverride}`
      : '\nTu esi draugiškas, profesionalus MiniSocial AI asistentas. Atsakyk aiškiai, glaustai ir lietuviškai (arba ta kalba, kuria kreipiasi vartotojas).',
  ]
    .filter(Boolean)
    .join('\n')

  // 6. Token budgeting & message construction
  const formattedUserMessage = formatUntrustedUserContent(newMessage)

  const historyWithTokens = history.map((m: any) => ({
    role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.content,
    tokens: estimateTokens(m.content),
  }))

  let totalTokens =
    estimateTokens(systemPrompt) +
    estimateTokens(formattedUserMessage) +
    historyWithTokens.reduce((sum: number, m: any) => sum + m.tokens, 0)

  const trimmedHistory = [...historyWithTokens]
  while (totalTokens > MAX_CONTEXT_TOKENS && trimmedHistory.length > 0) {
    const removed = trimmedHistory.shift()
    totalTokens -= removed?.tokens || 0
  }

  const messages: OmniMessage[] = [
    { role: 'system', content: systemPrompt },
    ...trimmedHistory.map((m) => ({
      role: m.role,
      content: m.role === 'user' ? formatUntrustedUserContent(m.content) : m.content,
    })),
    { role: 'user', content: formattedUserMessage },
  ]

  return {
    threadId: thread.threadId,
    messages,
    estimatedTokens: totalTokens,
    userMemory,
  }
}
