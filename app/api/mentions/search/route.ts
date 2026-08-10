import { z } from 'zod'
import { requireSession } from '@/lib/auth-session'
import { executePostgrest } from '@/lib/backend/postgrest'
import { rateLimit } from '@/lib/rate-limit'

const querySchema = z.object({
  q: z.string().min(1).max(32),
})

const MAX_RESULTS = 8

const searchLimiter = rateLimit({
  limit: 60,
  windowMs: 60 * 1000,
})

// Typed server-side interface for the composer's @-mention autocomplete.
// Deliberately not a passthrough to the generic /api/data/query proxy:
// this endpoint (a) enforces block-relationship exclusion server-side,
// which plain RLS on `profiles` does not do (profiles are publicly
// readable — see profiles_read policy), and (b) only ever returns the
// specific public fields a mention suggestion needs, never a raw profile
// row.
export async function GET(request: Request) {
  let session
  try {
    session = await requireSession()
  } catch {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({ q: url.searchParams.get('q') })
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 })
  }

  const limitResult = await searchLimiter.check(`mentions-search:${session.user.id}`)
  if (!limitResult.success) {
    return Response.json(
      { error: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(limitResult.resetIn) } },
    )
  }

  const userId = session.user.id
  const accessContext = { kind: 'user' as const, userId, email: session.user.email ?? undefined }

  // Block relationships are symmetric for visibility purposes: if either
  // side blocked the other, they should not appear in each other's
  // mention suggestions (matches the same "block overrides" rule applied
  // to comments visibility in db/migrations/0010_nested_comments.sql).
  const blocksResult = await executePostgrest<{ blocker_id: string; blocked_id: string }[]>(
    {
      table: 'blocks',
      method: 'GET',
      filters: [['or', `(blocker_id.eq.${userId},blocked_id.eq.${userId})`]],
      order: [],
      select: 'blocker_id,blocked_id',
    },
    accessContext,
  )

  const excludedIds = new Set<string>()
  for (const row of blocksResult.data || []) {
    excludedIds.add(row.blocker_id === userId ? row.blocked_id : row.blocker_id)
  }

  // Escape (not strip) ILIKE's wildcard characters — usernames legitimately
  // contain underscores (e.g. "tester_b"), so removing them would silently
  // corrupt a real, otherwise-matching query into one that matches nothing.
  // Escaping preserves the literal character while still preventing the
  // user's input from being interpreted as a wildcard pattern.
  const escaped = parsed.data.q.toLowerCase().replace(/[\\%_]/g, (char) => `\\${char}`)

  const filters: [string, string][] = [['username', `ilike.${escaped}%`]]
  if (excludedIds.size > 0) {
    filters.push(['id', `not.in.(${Array.from(excludedIds).join(',')})`])
  }

  const profilesResult = await executePostgrest<{ id: string; username: string; display_name: string; avatar_path: string | null }[]>(
    {
      table: 'profiles',
      method: 'GET',
      filters,
      order: ['username.asc'],
      select: 'id,username,display_name,avatar_path',
      limit: MAX_RESULTS,
    },
    accessContext,
  )

  if (profilesResult.error) {
    return Response.json({ error: 'SEARCH_FAILED' }, { status: 500 })
  }

  const results = profilesResult.data || []
  return Response.json({
    results: results.map((p) => ({
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarPath: p.avatar_path,
    })),
  })
}
