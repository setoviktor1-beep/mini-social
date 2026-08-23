import { assertValidUserId } from './security/isolation'

export async function getUserMemory(
  userId: string,
  supabase: any,
): Promise<Record<string, string>> {
  assertValidUserId(userId)

  const { data, error } = await supabase
    .from('ai_memory')
    .select('memory')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data?.memory || typeof data.memory !== 'object') {
    return {}
  }

  return data.memory as Record<string, string>
}

export function formatMemoryForPrompt(memory: Record<string, string>): string {
  const entries = Object.entries(memory).filter(([k, v]) => Boolean(k && v))
  if (entries.length === 0) return ''

  return `=== VARTOTOJO ATMINTIS (IŠ ANKSTESNIŲ POKALBIŲ) ===\n${entries
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')}`
}

export async function saveUserMemory(
  userId: string,
  newFacts: Record<string, string>,
  supabase: any,
): Promise<void> {
  assertValidUserId(userId)
  if (!newFacts || Object.keys(newFacts).length === 0) return

  const current = await getUserMemory(userId, supabase)
  const merged = { ...current, ...newFacts }

  // Cap memory to maximum 12 items to prevent bloat
  const keys = Object.keys(merged)
  if (keys.length > 12) {
    const trimmedKeys = keys.slice(-12)
    const trimmedObj: Record<string, string> = {}
    for (const k of trimmedKeys) {
      trimmedObj[k] = merged[k]
    }
    await supabase.from('ai_memory').upsert({
      user_id: userId,
      memory: trimmedObj,
      updated_at: new Date().toISOString(),
    })
    return
  }

  await supabase.from('ai_memory').upsert({
    user_id: userId,
    memory: merged,
    updated_at: new Date().toISOString(),
  })
}
