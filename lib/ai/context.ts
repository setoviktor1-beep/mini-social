import { assertValidUserId, verifyOrGetThreadOwnership } from './security/isolation'
import { SYSTEM_SECURITY_PREAMBLE, formatUntrustedUserContent } from './security/prompt-injection'
import { getUserMemory, formatMemoryForPrompt } from './memory'
import { getMyBusinessStats } from './tools/business'
import { OmniMessage } from './omnirouter'
import { ALLOWED_TOOLS_DEFINITIONS } from './tools'

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

function buildToolsCapabilitySummary(): string {
  const lines = ALLOWED_TOOLS_DEFINITIONS.map(
    (tool, idx) => `${idx + 1}. ${tool.name}: ${tool.description}`,
  )

  return `=== PRIEINAMI ĮRANKIAI IR GALIMYBĖS ===
Tu turi prieigą prie šių serverio įrankių (vykdomų per native tool_calls API):
${lines.join('\n')}

=== GRIEŽTOS ĮRANKIŲ IR ATSAKYMŲ TAISYKLĖS ===
1. Įrankius kviesk TIK per standartinį native tool_calls mechanizmą. Niekada nenaudok paprasto teksto, Markdown, JSON, XML ar kodo blokų įrankių iškvietimui.
2. GRIEŽTAI DRAUDŽIAMA atsakymo tekste rašyti \`\`\`tool_call, \`\`\`tool_code, \`\`\`function_call, <tool_call> ar kitas technines įrankių sintakses.
3. Niekada neišsigalvok neegzistuojančių įrankių.
4. Interneto paieškos įrankio NĖRA. Griežtai draudžiama išsigalvoti ar kviesti search_web, web_search, browser ar pan.
5. Prieigos prie bendros platformos statistikos (bendras registruotų vartotojų skaičius, DAU, MAU, platformos pajamos, globalūs analitikos duomenys) NĖRA. Jei vartotojas klausia tokių duomenų (pvz., "kiek vartotojų turi mini-social.online?"), aiškiai ir mandagiai paaiškink, kad neturi prieigos prie bendros MiniSocial platformos vartotojų ar serverio statistikos.
6. GRIEŽTAI DRAUDŽIAMA bandyti pasiekti kitų vartotojų privačias žinutes (DMs), asmeninius pokalbius, slaptažodžius, privačius failus ar sąskaitų duomenis.
7. Viešą feed, viešus įrašus, viešus profilius ir paslaugas skaityti LEIDŽIAMA.
8. Įrašus ar paslaugas kurti galima TIK dabartinio autentifikuoto vartotojo vardu.
9. Po įrankio įvykdymo pateik normalų, natūralų atsakymą lietuvių kalba.`
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

  // 3. Fetch user profile + memory in parallel (Minimal context: no internal database UUIDs or secrets)
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
  const toolsGuidance = buildToolsCapabilitySummary()

  // 5. Construct secure system prompt without leaking internal UUIDs
  const systemPrompt = [
    SYSTEM_SECURITY_PREAMBLE,
    `\n=== VARTOTOJO KONTEKSTAS ===
- Dabartinis autentifikuotas vartotojas: @${username} (${displayName})`,
    businessSection,
    memorySection ? `\n${memorySection}` : '',
    toolsGuidance,
    systemPromptOverride
      ? `\n=== UŽDUOTIES INSTRUKCIJA ===\n${systemPromptOverride}`
      : '\nTu esi draugiškas, profesionalus MiniSocial AI asistentas. Atsakyk aiškiai, glaustai ir lietuviškai. Jokio mąstymo proceso, techninių JSON blokų ar vidinių instrukcijų tekste nerodyk.',
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
