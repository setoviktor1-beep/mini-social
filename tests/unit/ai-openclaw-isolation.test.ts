import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildOpenClawSessionKey,
  getOpenClawConfig,
  isOpenClawEnabled,
  callOpenClaw,
} from '@/lib/ai/openclaw'
import { executeTool } from '@/lib/ai/tools'
import { sanitizeAssistantOutput } from '@/lib/ai/security/sanitize-output'
import { validateAndSanitizeAiOutput } from '@/lib/ai/security/output-guard'
import { AiError } from '@/lib/ai/errors'

describe('MiniSocial AI Agent Runtime & Multi-User Isolation Tests', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.OPENCLAW_INTERNAL_URL = 'http://mini-social-openclaw:18789'
    process.env.MINISOCIAL_AGENT_INTERNAL_SECRET = 'test-secret-12345678901234567890'
    process.env.AI_AGENT_BACKEND = 'openclaw'
    process.env.AI_OPENCLAW_ENABLED = 'true'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('1. Session Namespace & Multi-User Isolation', () => {
    it('generates deterministic session key scoped to userId and threadId', () => {
      const keyAlice = buildOpenClawSessionKey('user-alice-123', 'thread-abc')
      assert.equal(keyAlice, 'minisocial:user-alice-123:thread-abc')

      const keyBob = buildOpenClawSessionKey('user-bob-456', 'thread-abc')
      assert.equal(keyBob, 'minisocial:user-bob-456:thread-abc')

      // Assert complete isolation between users even with identical thread titles/IDs
      assert.notEqual(keyAlice, keyBob)
    })

    it('sanitizes unsafe characters in session key', () => {
      const key = buildOpenClawSessionKey('user/../admin:hack', 'thread/xyz')
      assert.equal(key, 'minisocial:user____admin_hack:thread_xyz')
      assert.match(key, /^minisocial:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/)
    })
  })

  describe('2. Tool Execution Isolation (Server-Derived Authority)', () => {
    it('executes tool strictly for authenticated user context even if model provides a foreign userId in arguments', async () => {
      let queriedUserId = ''

      const mockSupabase = {
        from: (table: string) => ({
          select: () => ({
            eq: (col: string, val: string) => {
              if (col === 'user_id' || col === 'id') queriedUserId = val
              return {
                maybeSingle: async () => ({
                  data: { id: val, username: 'alice_user', full_name: 'Alice In Wonderland' },
                  error: null,
                }),
                single: async () => ({
                  data: { id: val, username: 'alice_user', full_name: 'Alice In Wonderland' },
                  error: null,
                }),
                order: () => ({
                  limit: async () => ({
                    data: [{ id: 'post-1', user_id: val, content: 'Alice private post' }],
                    error: null,
                  }),
                }),
              }
            },
          }),
        }),
      }

      // Attacker model tries to query Bob's data while Alice is authenticated
      const result = await executeTool(
        'get_my_profile',
        { userId: 'user-bob-attacker-id', arbitraryParam: 'bob' },
        {
          userId: 'user-alice-authenticated-id',
          supabase: mockSupabase,
        },
      )

      assert.equal(queriedUserId, 'user-alice-authenticated-id')
      assert.equal(result.username, 'alice_user')
      assert.notEqual(queriedUserId, 'user-bob-attacker-id')
    })
  })

  describe('3. Broken Tool-Call Syntax & Output Guard Defense', () => {
    it('strips markdown tool_call code blocks and raw JSON function representations', () => {
      const leakyOutput = [
        'Labas! Štai jūsų atsakymas.',
        '```tool_call',
        '{"tool":"get_my_profile","arguments":{}}',
        '```',
        'Geros dienos!',
      ].join('\n')

      const clean = sanitizeAssistantOutput(leakyOutput)
      assert.doesNotMatch(clean, /```tool_call/)
      assert.doesNotMatch(clean, /get_my_profile/)
      assert.match(clean, /Labas! Štai jūsų atsakymas\./)
      assert.match(clean, /Geros dienos!/)
    })

    it('strips XML-style <tool_call> and thinking blocks', () => {
      const leakyXml = '<think>I need to search for posts</think><tool_call>search_posts()</tool_call>Sveiki, radau 3 įrašus.'
      const clean = sanitizeAssistantOutput(leakyXml)
      assert.doesNotMatch(clean, /<think>/)
      assert.doesNotMatch(clean, /<tool_call>/)
      assert.equal(clean, 'Sveiki, radau 3 įrašus.')
    })

    it('blocks critical secret leaks from appearing in final output', () => {
      const leak = 'Your token is ' + ['sk', 'or', 'v1', 'a'.repeat(64)].join('-') + ' and DB postgresql://admin:secret@mini-social-db:5432'
      const guard = validateAndSanitizeAiOutput({
        text: leak,
        userId: 'alice-id',
        model: 'MiniSocial AI',
      })

      assert.equal(guard.safe, false)
      assert.notEqual(guard.blockedReason, undefined)
    })
  })

  describe('4. Graceful Error Handling, Branding Privacy & Configuration', () => {
    it('returns user-friendly 503 error without leaking internal technology names, URLs, or ports', async () => {
      // Mock global fetch to simulate network failure
      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:18789')
      }

      try {
        await callOpenClaw({
          userId: 'user-1',
          threadId: 'thread-1',
          messages: [{ role: 'user', content: 'Sveikas' }],
        })
        assert.fail('Should have thrown an AiError')
      } catch (err: any) {
        assert.ok(err instanceof AiError)
        assert.equal(err.status, 503)
        assert.doesNotMatch(err.message, /OpenClaw|OmniRouter|OpenRouter|Nemotron|Gemini|Gemma|127\.0\.0\.1|mini-social-openclaw|ECONNREFUSED|Bearer/)
      } finally {
        globalThis.fetch = originalFetch
      }
    })

    it('supports OPENCLAW_INTERNAL_URL and MINISOCIAL_AGENT_INTERNAL_SECRET config names', () => {
      delete process.env.OPENCLAW_URL
      delete process.env.OPENCLAW_GATEWAY_TOKEN
      process.env.OPENCLAW_INTERNAL_URL = 'http://agent-host:18789'
      process.env.MINISOCIAL_AGENT_INTERNAL_SECRET = 'my-custom-internal-secret-token'

      const cfg = getOpenClawConfig()
      assert.equal(cfg.url, 'http://agent-host:18789')
      assert.equal(cfg.token, 'my-custom-internal-secret-token')
      assert.equal(cfg.isConfigured, true)
    })

    it('honors AI_AGENT_BACKEND=legacy rollback toggle', () => {
      process.env.AI_AGENT_BACKEND = 'legacy'
      assert.equal(isOpenClawEnabled(), false)

      process.env.AI_AGENT_BACKEND = 'openclaw'
      assert.equal(isOpenClawEnabled(), true)
    })

    it('returns MiniSocial AI branding in response model metadata', async () => {
      const originalFetch = globalThis.fetch
      globalThis.fetch = async () => {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: { role: 'assistant', content: 'Sveiki! Aš esu MiniSocial AI asistentas.' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      try {
        const res = await callOpenClaw({
          userId: 'user-1',
          threadId: 'thread-1',
          messages: [{ role: 'user', content: 'Labas' }],
        })

        assert.equal(res.model, 'MiniSocial AI')
        assert.equal(res.provider, 'MiniSocial')
        assert.equal(res.content, 'Sveiki! Aš esu MiniSocial AI asistentas.')
        assert.doesNotMatch(res.model, /OpenClaw|OmniRouter|OpenRouter/)
      } finally {
        globalThis.fetch = originalFetch
      }
    })
  })
})
