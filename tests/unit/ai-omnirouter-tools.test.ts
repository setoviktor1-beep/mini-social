import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { callOmniRouter, OpenAiToolDefinition } from '../../lib/ai/omnirouter'
import { buildToolSchemas } from '../../lib/ai/tools'

process.env.OMNIROUTER_API_KEY = 'test-omnirouter-key'
process.env.OMNIROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

describe('OmniRouter Native Tool Calling Request & Response', () => {
  const originalFetch = globalThis.fetch

  test('sends tools and tool_choice when tools are provided', async () => {
    let capturedBody: any = null

    globalThis.fetch = async (url: any, init: any) => {
      capturedBody = JSON.parse(init.body)
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Hello without tool',
              },
              finish_reason: 'stop',
            },
          ],
          model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    try {
      const tools = buildToolSchemas()
      assert.ok(tools.length > 0)
      assert.ok(tools.some((t) => t.function.name === 'get_my_profile'))
      assert.ok(tools.every((t) => t.type === 'function'))

      const response = await callOmniRouter({
        messages: [{ role: 'user', content: 'Koks mano profilis?' }],
        tools,
        toolChoice: 'auto',
      })

      assert.equal(response.content, 'Hello without tool')
      assert.equal(capturedBody.tool_choice, 'auto')
      assert.ok(Array.isArray(capturedBody.tools))
      assert.equal(capturedBody.tools.length, tools.length)
      assert.equal(capturedBody.tools[0].function.parameters.additionalProperties, false)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('does not send tools or tool_choice when tools array is empty or undefined', async () => {
    let capturedBody: any = null

    globalThis.fetch = async (url: any, init: any) => {
      capturedBody = JSON.parse(init.body)
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Normal answer without tools',
              },
              finish_reason: 'stop',
            },
          ],
          model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    try {
      await callOmniRouter({
        messages: [{ role: 'user', content: 'Labas' }],
      })

      assert.equal(capturedBody.tools, undefined)
      assert.equal(capturedBody.tool_choice, undefined)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('handles native tool call with content: null and finish_reason: tool_calls without error', async () => {
    globalThis.fetch = async () => {
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  {
                    id: 'call_abc123',
                    type: 'function',
                    function: {
                      name: 'search_public_posts',
                      arguments: '{"query":"statyba","limit":5}',
                    },
                  },
                ],
              },
              finish_reason: 'tool_calls',
            },
          ],
          model: 'google/gemini-3.5-flash-lite',
          usage: { prompt_tokens: 25, completion_tokens: 10, total_tokens: 35 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }

    try {
      const response = await callOmniRouter({
        messages: [{ role: 'user', content: 'Rask viešus įrašus apie statybą' }],
        tools: buildToolSchemas(),
      })

      assert.equal(response.content, null)
      assert.equal(response.finishReason, 'tool_calls')
      assert.equal(response.toolCalls.length, 1)
      assert.equal(response.toolCalls[0].id, 'call_abc123')
      assert.equal(response.toolCalls[0].function.name, 'search_public_posts')
      assert.equal(response.toolCalls[0].function.arguments, '{"query":"statyba","limit":5}')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
