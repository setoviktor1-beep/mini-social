import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { aiGateway } from '../../lib/ai/gateway'
import { sanitizeAssistantOutput, containsLeakedToolSyntax } from '../../lib/ai/security/sanitize-output'

const TEST_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const TEST_THREAD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

process.env.OMNIROUTER_API_KEY = 'test-omnirouter-key'
process.env.OMNIROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

function createMockSupabase() {
  const messagesTable: any[] = []

  return {
    messagesTable,
    from: (table: string) => {
      if (table === 'ai_conversations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: TEST_THREAD_ID, user_id: TEST_USER_ID, title: 'Regression Test' },
                  error: null,
                }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({ eq: async () => ({ error: null }) }),
          }),
        }
      }

      if (table === 'ai_messages') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
          insert: async (rows: any[]) => {
            messagesTable.push(...rows)
            return { error: null }
          },
        }
      }

      if (table === 'profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { username: 'testuser', display_name: 'Test User', role: 'user' },
                error: null,
              }),
            }),
          }),
        }
      }

      if (table === 'ai_usage_logs') {
        return { insert: async () => ({ error: null }) }
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
  }
}

describe('Production Bug Regression: kiek vartotojų turi mini-social.online?', () => {
  const originalFetch = globalThis.fetch

  test('regression: model asking for search_web receives unavailable tool and returns natural language answer without leaked tool syntax', async () => {
    let callCount = 0

    globalThis.fetch = async (url: any, init: any) => {
      callCount++
      const body = JSON.parse(init.body)

      if (callCount === 1) {
        // Model attempts to hallucinate search_web
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_search_web_attempt',
                      type: 'function',
                      function: {
                        name: 'search_web',
                        arguments: '{"query":"mini-social.online vartotojai kiek"}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            model: 'google/gemini-3.5-flash-lite',
            usage: { prompt_tokens: 35, completion_tokens: 15, total_tokens: 50 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      } else {
        // Model gives proper final natural language answer
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Neturiu prieigos prie bendros MiniSocial platformos vartotojų statistikos.',
                },
                finish_reason: 'stop',
              },
            ],
            model: 'google/gemini-3.5-flash-lite',
            usage: { prompt_tokens: 65, completion_tokens: 20, total_tokens: 85 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    try {
      const mockDb = createMockSupabase()
      const result = await aiGateway.chat({
        supabase: mockDb,
        userId: TEST_USER_ID,
        threadId: TEST_THREAD_ID,
        message: 'kiek vartotojų turi mini-social.online?',
        ip: '127.0.0.1',
      })

      // Must NOT contain any tool call or code blocks
      assert.ok(!result.reply.includes('tool_call'))
      assert.ok(!result.reply.includes('search_web'))
      assert.ok(!result.reply.includes('```'))
      assert.ok(!containsLeakedToolSyntax(result.reply))

      // Must be a proper natural language answer
      assert.equal(
        result.reply,
        'Neturiu prieigos prie bendros MiniSocial platformos vartotojų statistikos.',
      )

      // Only clean final message saved to DB
      assert.equal(mockDb.messagesTable.length, 2)
      assert.equal(
        mockDb.messagesTable[1].content,
        'Neturiu prieigos prie bendros MiniSocial platformos vartotojų statistikos.',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('regression: raw leaked markdown block is sanitized and retried if emitted directly in text', async () => {
    let callCount = 0

    globalThis.fetch = async () => {
      callCount++
      if (callCount === 1) {
        // Model directly printed raw markdown tool block in text
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: '```tool_call\n{"tool":"search_web","query":"mini-social.online vartotojai kiek"}\n```',
                },
                finish_reason: 'stop',
              },
            ],
            model: 'google/gemini-3.5-flash-lite',
            usage: { prompt_tokens: 30, completion_tokens: 20, total_tokens: 50 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      } else {
        // Retry call with natural language
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Neturiu prieigos prie bendros platformos vartotojų statistikos.',
                },
                finish_reason: 'stop',
              },
            ],
            model: 'google/gemini-3.5-flash-lite',
            usage: { prompt_tokens: 50, completion_tokens: 15, total_tokens: 65 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    try {
      const mockDb = createMockSupabase()
      const result = await aiGateway.chat({
        supabase: mockDb,
        userId: TEST_USER_ID,
        threadId: TEST_THREAD_ID,
        message: 'kiek vartotojų turi mini-social.online?',
        ip: '127.0.0.1',
      })

      assert.ok(!result.reply.includes('tool_call'))
      assert.ok(!result.reply.includes('search_web'))
      assert.ok(!containsLeakedToolSyntax(result.reply))
      assert.equal(
        result.reply,
        'Neturiu prieigos prie bendros platformos vartotojų statistikos.',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
