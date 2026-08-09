import { z } from 'zod'
import { getSession } from '@/lib/auth-session'
import { executePostgrest } from '@/lib/backend/postgrest'
import { publishChange } from '@/lib/realtime-publisher'

export const dynamic = 'force-dynamic'

const allowedTables = new Set([
  'agent_config',
  'agent_messages',
  'agent_trigger_log',
  'ai_conversations',
  'ai_memory',
  'ai_messages',
  'ai_usage',
  'billing_checkout_sessions',
  'blocks',
  'bookmarks',
  'calendar_events',
  'comments',
  'conversations',
  'discussion_replies',
  'discussions',
  'financial_settings',
  'follows',
  'friend_requests',
  'likes',
  'maps_cache',
  'messages',
  'moderation_actions',
  'monthly_income',
  'mutes',
  'notifications',
  'orders',
  'post_media',
  'posts',
  'pro_services',
  'processed_events',
  'profiles',
  'push_subscriptions',
  'quick_reply_templates',
  'receipts',
  'reports',
  'reposts',
  'service_requests',
  'subscriptions',
  'usage_logs',
  'wallet_transactions',
])

const allowedRpc = new Set([
  'check_and_increment_ai_usage',
  'credit_wallet_and_complete_transaction',
  'get_nearby_post_ids',
  'get_or_create_conversation',
  'update_profile_location',
])

function isAllowedTarget(target: string) {
  if (target.startsWith('rpc/')) {
    return allowedRpc.has(target.slice(4))
  }
  return allowedTables.has(target)
}

const querySchema = z.object({
  table: z
    .string()
    .min(1)
    .regex(/^(?:rpc\/)?[a-z_][a-z0-9_]*$/),
  method: z.enum(['GET', 'POST', 'PATCH', 'DELETE']),
  select: z.string().max(20_000).optional(),
  body: z.unknown().optional(),
  filters: z.array(z.tuple([z.string().max(200), z.string().max(10_000)])),
  order: z.array(z.string().max(500)),
  limit: z.number().int().min(0).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
  single: z.enum(['single', 'maybeSingle']).optional(),
  count: z.enum(['exact', 'planned', 'estimated']).optional(),
  head: z.boolean().optional(),
  upsert: z
    .object({
      onConflict: z.string().max(500).optional(),
      ignoreDuplicates: z.boolean().optional(),
    })
    .optional(),
})

export async function POST(request: Request) {
  const session = await getSession()
  const parsed = querySchema.safeParse(await request.json())

  if (!parsed.success) {
    return Response.json(
      { error: { message: 'INVALID_QUERY', details: parsed.error.message } },
      { status: 400 },
    )
  }

  if (!isAllowedTarget(parsed.data.table)) {
    return Response.json(
      { error: { message: 'QUERY_TARGET_FORBIDDEN' } },
      { status: 403 },
    )
  }

  const result = await executePostgrest(
    parsed.data,
    session?.user
      ? {
          kind: 'user',
          userId: session.user.id,
          email: session.user.email,
        }
      : { kind: 'anonymous' },
  )
  if (!result.error) {
    await publishChange(parsed.data, result, session?.user.id)
  }

  return Response.json(result, { status: result.error ? result.status : 200 })
}
