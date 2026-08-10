type MentionTargetType = 'post' | 'comment' | 'discussion'

interface NotifyMentionsParams {
  supabase: any
  content: string
  actorId: string
  targetId: string
  targetType: MentionTargetType
  excludeUserIds?: string[]
}

export interface MentionTrigger {
  start: number // index of '@' in content
  end: number // cursor position (exclusive) — the span [start, end) is replaced on selection
  query: string
}

// Finds the @-mention trigger the cursor is currently inside, if any.
// Walks backward from the cursor over word characters to find an '@' that
// isn't itself preceded by a word character, so "user@example.com" doesn't
// trigger mid-word — only an '@' at the start of a word does.
export function detectMentionTrigger(text: string, cursor: number): MentionTrigger | null {
  if (cursor < 0 || cursor > text.length) return null
  let i = cursor - 1
  while (i >= 0 && /[A-Za-z0-9_]/.test(text[i])) i--
  if (i < 0 || text[i] !== '@') return null
  const precedingChar = i > 0 ? text[i - 1] : ''
  if (/[A-Za-z0-9_]/.test(precedingChar)) return null
  return { start: i, end: cursor, query: text.slice(i + 1, cursor) }
}

export function extractMentionUsernames(content: string): string[] {
  if (!content) return []

  const re = /@([A-Za-z0-9_]{3,32})/g
  const usernames = new Set<string>()
  let m: RegExpExecArray | null

  while ((m = re.exec(content)) !== null) {
    const username = m[1]?.toLowerCase()
    if (username) usernames.add(username)
  }

  return Array.from(usernames)
}

export async function notifyMentions({
  supabase,
  content,
  actorId,
  targetId,
  targetType,
  excludeUserIds = [],
}: NotifyMentionsParams) {
  const usernames = extractMentionUsernames(content)
  if (usernames.length === 0) return

  const { data: mentionedProfiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', usernames)

  if (!mentionedProfiles || mentionedProfiles.length === 0) return

  const excluded = new Set(excludeUserIds)
  const recipientIds = mentionedProfiles
    .map((p: any) => p.id as string)
    .filter((uid: string) => uid && uid !== actorId && !excluded.has(uid))

  if (recipientIds.length === 0) return

  await supabase.from('notifications').insert(
    recipientIds.map((uid: string) => ({
      user_id: uid,
      actor_id: actorId,
      type: 'mention',
      target_id: targetId,
      target_type: targetType,
    }))
  )
}
