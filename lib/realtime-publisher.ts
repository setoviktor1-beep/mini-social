import Redis from 'ioredis'
import { executePostgrest } from '@/lib/backend/postgrest'
import type { BackendResult, QuerySpec } from '@/lib/backend/query'

type ChangeEvent = {
  table: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: unknown
  old: unknown
  audience: string[] | null
}

let publisher: Redis | undefined

function getPublisher() {
  if (!process.env.REDIS_URL) return null
  publisher ||= new Redis(process.env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  })
  return publisher
}

function rows(value: unknown) {
  if (Array.isArray(value)) return value
  return value && typeof value === 'object' ? [value] : []
}

async function determineAudience(
  spec: QuerySpec,
  result: BackendResult<any>,
  actorId?: string,
) {
  const records = rows(result.data)
  const body = rows(spec.body)
  const candidates = records.length ? records : body

  if (spec.table === 'notifications') {
    return Array.from(
      new Set(
        candidates
          .map((row: any) => row?.user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    )
  }

  if (spec.table === 'conversations') {
    return Array.from(
      new Set(
        candidates.flatMap((row: any) => [row?.user1_id, row?.user2_id])
          .filter((id): id is string => typeof id === 'string'),
      ),
    )
  }

  if (spec.table === 'messages') {
    const conversationId = candidates.find(
      (row: any) => typeof row?.conversation_id === 'string',
    )?.conversation_id
    if (conversationId) {
      const conversation = await executePostgrest<any>(
        {
          table: 'conversations',
          method: 'GET',
          select: 'user1_id,user2_id',
          filters: [['id', `eq.${conversationId}`]],
          order: [],
          single: 'maybeSingle',
        },
        { kind: 'service' },
      )
      if (conversation.data) {
        return [
          conversation.data.user1_id,
          conversation.data.user2_id,
        ].filter(Boolean)
      }
    }
  }

  const publicTables = new Set([
    'posts',
    'post_media',
    'likes',
    'comments',
    'follows',
    'reposts',
    'profiles',
    'discussions',
    'discussion_replies',
    'pro_services',
  ])
  return publicTables.has(spec.table) ? null : actorId ? [actorId] : []
}

export async function publishChange(
  spec: QuerySpec,
  result: BackendResult<any>,
  actorId?: string,
) {
  if (spec.method === 'GET' || spec.table.startsWith('rpc/')) return
  const redis = getPublisher()
  if (!redis) return

  try {
    if (redis.status === 'wait') await redis.connect()
    const eventType =
      spec.method === 'POST'
        ? 'INSERT'
        : spec.method === 'PATCH'
          ? 'UPDATE'
          : 'DELETE'
    const event: ChangeEvent = {
      table: spec.table,
      eventType,
      new: eventType === 'DELETE' ? null : result.data ?? spec.body ?? null,
      old: eventType === 'DELETE' ? result.data : null,
      audience: await determineAudience(spec, result, actorId),
    }
    await redis.publish('mini-social:db-change', JSON.stringify(event))
  } catch (error) {
    console.error('Realtime publish failed', error)
  }
}
