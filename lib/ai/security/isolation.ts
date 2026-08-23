import { AiError } from '../errors'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function assertValidUserId(userId: string | null | undefined): asserts userId is string {
  if (!userId || typeof userId !== 'string' || !UUID_REGEX.test(userId)) {
    throw new AiError('AI_FORBIDDEN', 'Neteisingas vartotojo identifikatorius', { status: 401 })
  }
}

export function isValidUuid(id: string | null | undefined): id is string {
  return Boolean(id && typeof id === 'string' && UUID_REGEX.test(id))
}

export interface ThreadOwnershipResult {
  threadId: string
  userId: string
  title: string
  isNew: boolean
}

export async function verifyOrGetThreadOwnership(params: {
  supabase: any
  userId: string
  threadId?: string | null
  title?: string
}): Promise<ThreadOwnershipResult> {
  const { supabase, userId, threadId, title = 'Naujas pokalbis' } = params
  assertValidUserId(userId)

  if (threadId) {
    if (!isValidUuid(threadId)) {
      // Do not reveal existence of thread, return 404
      throw new AiError('AI_NOT_FOUND', 'Pokalbis nerastas', { status: 404 })
    }

    const { data: thread, error } = await supabase
      .from('ai_conversations')
      .select('id, user_id, title')
      .eq('id', threadId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error || !thread) {
      throw new AiError('AI_NOT_FOUND', 'Pokalbis nerastas', { status: 404 })
    }

    // STRICT P0 CHECK: Thread MUST belong to authenticated user
    if (thread.user_id !== userId) {
      // Never reveal thread existence to another user
      throw new AiError('AI_NOT_FOUND', 'Pokalbis nerastas', { status: 404 })
    }

    return {
      threadId: thread.id,
      userId: thread.user_id,
      title: thread.title,
      isNew: false,
    }
  }

  // Create new thread for authenticated user
  const { data: newThread, error: createError } = await supabase
    .from('ai_conversations')
    .insert({
      user_id: userId,
      title,
    })
    .select('id, user_id, title')
    .single()

  if (createError || !newThread) {
    throw new AiError('AI_INTERNAL_ERROR', 'Nepavyko sukurti naujo pokalbio', {
      details: createError?.message,
    })
  }

  return {
    threadId: newThread.id,
    userId: newThread.user_id,
    title: newThread.title,
    isNew: true,
  }
}
