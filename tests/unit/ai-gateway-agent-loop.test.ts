import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { aiGateway, MAX_TOOL_ROUNDS } from '../../lib/ai/gateway'
import { formatUntrustedToolOutput } from '../../lib/ai/security/prompt-injection'

const USER_ID = '33333333-3333-4333-8333-333333333333'
const THREAD_ID = '44444444-4444-4444-8444-444444444444'

process.env.OMNIROUTER_API_KEY = 'test-omnirouter-key'
process.env.OMNIROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

function createMockSupabase() {
  const messagesTable: any[] = []
  const usageLogsTable: any[] = []

  return {
    messagesTable,
    usageLogsTable,
    from: (table: string) => {
      if (table === 'ai_conversations') {
        return {
          select: () => ({
            eq: (_col1: string, _val1: any) => ({
              eq: (_col2: string, _val2: any) => ({
                maybeSingle: async () => ({
                  data: { id: THREAD_ID, user_id: USER_ID, title: 'Test' },
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
        return {
          insert: async (row: any) => {
            usageLogsTable.push(row)
            return { error: null }
          },
        }
      }

      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      }
    },
  }
}

describe('AI Gateway Agentic Tool Loop', () => {
  const originalFetch = globalThis.fetch

  test('executes multi-round tool loop and persists only final natural language assistant response', async () => {
    let fetchCalls: any[] = []

    globalThis.fetch = async (url: any, init: any) => {
      const body = JSON.parse(init.body)
      fetchCalls.push(body)

      if (fetchCalls.length === 1) {
        // Round 1: Model requests get_my_profile
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_profile_1',
                      type: 'function',
                      function: {
                        name: 'get_my_profile',
                        arguments: '{}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
            usage: { prompt_tokens: 40, completion_tokens: 15, total_tokens: 55 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      } else {
        // Round 2: Model answers in Lithuanian
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Jūsų profilio slapyvardis yra @testuser.',
                },
                finish_reason: 'stop',
              },
            ],
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
            usage: { prompt_tokens: 70, completion_tokens: 20, total_tokens: 90 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    try {
      const mockDb = createMockSupabase()
      const result = await aiGateway.chat({
        supabase: mockDb,
        userId: USER_ID,
        threadId: THREAD_ID,
        message: 'Koks mano slapyvardis?',
        ip: '127.0.0.1',
      })

      const chatCalls = fetchCalls.filter(
        (c: any) =>
          !c.messages?.[0]?.content?.includes('fact extractor'),
      )
      assert.equal(chatCalls.length, 2)

      // Verify Round 2 received role: tool message
      const round2Messages = chatCalls[1].messages
      const toolMessage = round2Messages.find((m: any) => m.role === 'tool')
      assert.ok(toolMessage)
      assert.equal(toolMessage.tool_call_id, 'call_profile_1')
      assert.equal(toolMessage.name, 'get_my_profile')
      assert.ok(toolMessage.content.includes('[UNTRUSTED_EXTERNAL_CONTENT: get_my_profile]'))

      // Verify only 2 messages persisted to DB (1 user, 1 final assistant)
      assert.equal(mockDb.messagesTable.length, 2)
      assert.equal(mockDb.messagesTable[0].role, 'user')
      assert.equal(mockDb.messagesTable[1].role, 'assistant')
      assert.equal(mockDb.messagesTable[1].content, 'Jūsų profilio slapyvardis yra @testuser.')

      // Verify token accounting summed across rounds (40 + 70 = 110, 15 + 20 = 35)
      assert.equal(result.usage.promptTokens, 110)
      assert.equal(result.usage.completionTokens, 35)
      assert.equal(result.usage.totalTokens, 145)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('safely handles unknown tool requests like search_web without crash', async () => {
    let fetchCalls: any[] = []

    globalThis.fetch = async (url: any, init: any) => {
      const body = JSON.parse(init.body)
      fetchCalls.push(body)

      if (fetchCalls.length === 1) {
        // Model hallucinating search_web
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_hallucinated',
                      type: 'function',
                      function: {
                        name: 'search_web',
                        arguments: '{"query":"mini-social users"}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
            usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      } else {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Aš neturiu prieigos prie interneto paieškos.',
                },
                finish_reason: 'stop',
              },
            ],
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
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
        userId: USER_ID,
        threadId: THREAD_ID,
        message: 'Paieškok internete',
        ip: '127.0.0.1',
      })

      assert.equal(result.reply, 'Aš neturiu prieigos prie interneto paieškos.')
      const chatCalls = fetchCalls.filter(
        (c: any) =>
          !c.messages?.[0]?.content?.includes('fact extractor'),
      )
      assert.equal(chatCalls.length, 2)

      const toolMsg = chatCalls[1].messages.find((m: any) => m.role === 'tool')
      assert.ok(toolMsg)
      assert.ok(toolMsg.content.includes('Tool unavailable: the requested tool does not exist or is not permitted.'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('safely handles malformed arguments without 500 error', async () => {
    let fetchCalls: any[] = []

    globalThis.fetch = async (url: any, init: any) => {
      const body = JSON.parse(init.body)
      fetchCalls.push(body)

      if (fetchCalls.length === 1) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_broken',
                      type: 'function',
                      function: {
                        name: 'search_public_posts',
                        arguments: '{"query": BROKEN JSON',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
            usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      } else {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  role: 'assistant',
                  content: 'Nepavyko atlikti paieškos dėl netinkamų parametrų.',
                },
                finish_reason: 'stop',
              },
            ],
            model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
            usage: { prompt_tokens: 45, completion_tokens: 15, total_tokens: 60 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
    }

    try {
      const mockDb = createMockSupabase()
      const result = await aiGateway.chat({
        supabase: mockDb,
        userId: USER_ID,
        threadId: THREAD_ID,
        message: 'Rask įrašus',
        ip: '127.0.0.1',
      })

      assert.equal(result.reply, 'Nepavyko atlikti paieškos dėl netinkamų parametrų.')
      const chatCalls = fetchCalls.filter(
        (c: any) =>
          !c.messages?.[0]?.content?.includes('fact extractor'),
      )
      const toolMsg = chatCalls[1].messages.find((m: any) => m.role === 'tool')
      assert.ok(toolMsg.content.includes('Tool arguments were invalid'))
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('stops tool loop at MAX_TOOL_ROUNDS (3) avoiding infinite loop', async () => {
    let fetchCount = 0

    globalThis.fetch = async (url: any, init: any) => {
      fetchCount++
      // Model endlessly asks for get_my_profile
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: fetchCount >= MAX_TOOL_ROUNDS ? 'Galutinis atsakymas po 3 raundų.' : null,
                tool_calls:
                  fetchCount < MAX_TOOL_ROUNDS
                    ? [
                        {
                          id: `call_loop_${fetchCount}`,
                          type: 'function',
                          function: { name: 'get_my_profile', arguments: '{}' },
                        },
                      ]
                    : [],
              },
              finish_reason: fetchCount < MAX_TOOL_ROUNDS ? 'tool_calls' : 'stop',
            },
          ],
          model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    try {
      const mockDb = createMockSupabase()
      const result = await aiGateway.chat({
        supabase: mockDb,
        userId: USER_ID,
        threadId: THREAD_ID,
        message: 'Loop test',
        ip: '127.0.0.1',
      })

      assert.equal(fetchCount, MAX_TOOL_ROUNDS)
      assert.equal(result.reply, 'Galutinis atsakymas po 3 raundų.')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
