import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { executeTool } from '../../lib/ai/tools'
import { checkResourceAccess, validateToolPermission } from '../../lib/ai/permissions'
import { AiError } from '../../lib/ai/errors'

const ALICE_ID = '11111111-1111-4111-8111-111111111111'
const BOB_ID = '22222222-2222-4222-8222-222222222222'

function createMockDb() {
  const posts: any[] = [
    { id: 'p1', user_id: ALICE_ID, content: 'Alice public post in feed', location: 'Vilnius', status: 'active', created_at: '2026-08-23T10:00:00Z', likes_count: 5, comments_count: 2, author: { username: 'alice', display_name: 'Alice Cooper' } },
    { id: 'p2', user_id: BOB_ID, content: 'Bob public post in feed', location: 'Kaunas', status: 'active', created_at: '2026-08-23T10:05:00Z', likes_count: 1, comments_count: 0, author: { username: 'bob', display_name: 'Bob Marley' } },
  ]

  return {
    posts,
    from: (table: string) => {
      if (table === 'posts') {
        let filterEq: Record<string, any> = {}
        let limitVal = 10

        const qb: any = {
          select: () => qb,
          eq: (col: string, val: any) => {
            filterEq[col] = val
            return qb
          },
          order: () => qb,
          limit: (n: number) => {
            limitVal = n
            return qb
          },
          insert: (obj: any) => {
            const newPost = {
              id: 'p-' + Math.random().toString(36).slice(2, 8),
              ...obj,
              created_at: new Date().toISOString(),
              likes_count: 0,
              comments_count: 0,
            }
            posts.push(newPost)
            return {
              select: () => ({
                single: async () => ({ data: newPost, error: null }),
              }),
            }
          },
          then: (resolve: any) => {
            let res = posts.filter((p) => {
              for (const [k, v] of Object.entries(filterEq)) {
                if (p[k] !== v) return false
              }
              return true
            })
            resolve({ data: res.slice(0, limitVal), error: null })
          },
        }
        return qb
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }
    },
  }
}

describe('AI Capabilities: Posting, Feed Reading & Strict Privacy Boundaries', () => {
  test('1. AI can create and publish a post on behalf of authenticated user', async () => {
    const mockDb = createMockDb()
    const result = await executeTool(
      'create_post',
      { content: 'Sveiki visi! AI sukurtas pranešimas 🚀' },
      { userId: ALICE_ID, supabase: mockDb },
    )

    assert.equal(result.success, true)
    assert.equal(result.post.content, 'Sveiki visi! AI sukurtas pranešimas 🚀')

    // Verify post in database is assigned strictly to Alice
    const created = mockDb.posts.find((p) => p.id === result.post.id)
    assert(created)
    assert.equal(created.user_id, ALICE_ID)
    assert.notEqual(created.user_id, BOB_ID)
  })

  test('2. AI can read public social feed (feed reading allowed)', async () => {
    const mockDb = createMockDb()
    const result = await executeTool(
      'get_public_feed',
      { limit: 10 },
      { userId: BOB_ID, supabase: mockDb },
    )

    assert.equal(result.count, 2)
    assert(Array.isArray(result.feed))
    assert.equal(result.feed[0].content, 'Alice public post in feed')
    assert.equal(result.feed[1].content, 'Bob public post in feed')
  })

  test('3. search_web and browse_web_page are strictly forbidden and throw AI_FORBIDDEN', () => {
    assert.throws(
      () => validateToolPermission('search_web', new Set(['public:read', 'profile:read_self'])),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
    assert.throws(
      () => validateToolPermission('browse_web_page', new Set(['public:read', 'profile:read_self'])),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
  })

  test('4. AI is STRICTLY FORBIDDEN from accessing other users private messages (DMs), tokens, secrets', () => {
    assert.throws(
      () => checkResourceAccess('messages'),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN' && err.status === 403,
    )
    assert.throws(
      () => checkResourceAccess('direct_messages'),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
    assert.throws(
      () => checkResourceAccess('user_secrets'),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
    assert.throws(
      () => checkResourceAccess('auth_tokens'),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
    assert.throws(
      () => checkResourceAccess('billing_secrets'),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
    assert.throws(
      () => checkResourceAccess('ai_memory:other'),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
    assert.throws(
      () => checkResourceAccess('platform_stats'),
      (err: any) => err instanceof AiError && err.code === 'AI_FORBIDDEN',
    )
  })
})
