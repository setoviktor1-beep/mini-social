type MentionTargetType = 'post' | 'comment' | 'discussion'

interface NotifyMentionsParams {
  supabase: any
  content: string
  actorId: string
  targetId: string
  targetType: MentionTargetType
  excludeUserIds?: string[]
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
