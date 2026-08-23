import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateAndSanitizeAiOutput } from '../../lib/ai/security/output-guard'
import { executeTool } from '../../lib/ai/tools'
import { checkResourceAccess, validateToolPermission, AiPermissionScope } from '../../lib/ai/permissions'
import { buildServerContext } from '../../lib/ai/context'
import { prepareCreateService } from '../../lib/ai/tools/business'
import { prepareCreatePost } from '../../lib/ai/tools/social'

describe('P0 AI Security, Output Leak Guard & Cross-User Sandbox Isolation', () => {
  const ALICE_ID = '11111111-1111-4111-8111-111111111111'
  const BOB_ID = '22222222-2222-4222-8222-222222222222'

  describe('1. Output Guard Leak Detection & Sanitization', () => {
    it('strips "Thinking Process" header and returns clean Lithuanian reply', () => {
      const dirtyOutput = `Here's a thinking process:
1. Analyze user request
2. Formulate response

Sveiki! Aš esu jūsų MiniSocial AI asistentas. Kuo galiu padėti?`

      const result = validateAndSanitizeAiOutput({ text: dirtyOutput, userId: ALICE_ID })
      assert.equal(result.safe, true)
      assert.ok(!result.sanitizedText.includes('thinking process'))
      assert.ok(!result.sanitizedText.includes('Analyze user request'))
      assert.ok(result.sanitizedText.includes('Sveiki! Aš esu jūsų MiniSocial AI asistentas.'))
    })

    it('strips XML <think>...</think> and <thought> tags completely', () => {
      const dirtyOutput = `<think>Internal thoughts about DB queries and user context</think>Jūsų naujausias įrašas buvo sėkmingai paskelbtas.`
      const result = validateAndSanitizeAiOutput({ text: dirtyOutput, userId: ALICE_ID })
      assert.equal(result.safe, true)
      assert.ok(!result.sanitizedText.includes('<think>'))
      assert.ok(!result.sanitizedText.includes('Internal thoughts'))
      assert.equal(result.sanitizedText, 'Jūsų naujausias įrašas buvo sėkmingai paskelbtas.')
    })

    it('blocks critical secret leaks (API keys, DB connection strings, Bearer tokens)', () => {
      const apiKeyLeak = 'Štai jūsų raktas: sk-test-dummy-api-token-value-12345678901234567890'
      const dbLeak = 'Prisijungimas prie DB: postgresql://mini_social:secret_password@127.0.0.1:5432/mini_social'
      const bearerLeak = 'Naudokite token: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.fake_token_value_here'

      assert.equal(validateAndSanitizeAiOutput({ text: apiKeyLeak }).safe, false)
      assert.equal(validateAndSanitizeAiOutput({ text: dbLeak }).safe, false)
      assert.equal(validateAndSanitizeAiOutput({ text: bearerLeak }).safe, false)
    })

    it('scrubs authenticated user UUID if present in output text', () => {
      const uuidLeakingOutput = `Jūsų profilio ID serveryje yra ${ALICE_ID}.`
      const result = validateAndSanitizeAiOutput({ text: uuidLeakingOutput, userId: ALICE_ID })
      assert.equal(result.safe, true)
      assert.ok(!result.sanitizedText.includes(ALICE_ID))
      assert.ok(result.sanitizedText.includes('[CURRENT_USER]'))
    })

    it('blocks responses that contain only internal thinking or become empty', () => {
      const onlyThinking = `Here's a thinking process:
1. Nothing else to say.`
      const result = validateAndSanitizeAiOutput({ text: onlyThinking })
      assert.equal(result.safe, false)
    })
  })

  describe('2. Cross-User Isolation & Forbidden Resource Access', () => {
    it('strictly denies access to private messages / DMs', () => {
      assert.throws(() => checkResourceAccess('messages'), (err: any) => {
        return err.code === 'AI_FORBIDDEN'
      })
      assert.throws(() => checkResourceAccess('direct_messages/thread_123'), (err: any) => {
        return err.code === 'AI_FORBIDDEN'
      })
    })

    it('strictly denies arbitrary SQL queries or database dumps', () => {
      assert.throws(() => checkResourceAccess('query_database'), (err: any) => {
        return err.code === 'AI_FORBIDDEN'
      })
      assert.throws(() => checkResourceAccess('execute_sql'), (err: any) => {
        return err.code === 'AI_FORBIDDEN'
      })
      assert.throws(() => checkResourceAccess('admin_query'), (err: any) => {
        return err.code === 'AI_FORBIDDEN'
      })
    })

    it('strictly denies accessing other users private AI memory or private email', () => {
      assert.throws(() => checkResourceAccess('ai_memory:other'), (err: any) => {
        return err.code === 'AI_FORBIDDEN'
      })
      assert.throws(() => checkResourceAccess('profiles:private_email'), (err: any) => {
        return err.code === 'AI_FORBIDDEN'
      })
    })
  })

  describe('3. Tool Execution Context Binding (No Model-Controlled UserId)', () => {
    it('executes tool strictly for authenticated user context even if model passes foreign userId in args', async () => {
      let passedUserIdToDb = ''
      const mockSupabase = {
        from: (table: string) => {
          assert.equal(table, 'posts')
          return {
            select: () => ({
              eq: (field: string, val: string) => {
                assert.equal(field, 'user_id')
                passedUserIdToDb = val
                return {
                  order: () => ({
                    limit: () => Promise.resolve({ data: [{ id: 'p1', content: 'Bob post', created_at: new Date().toISOString() }], error: null }),
                  }),
                }
              },
            }),
          }
        },
      }

      // Bob makes tool call, but model tries to supply args.userId = ALICE_ID
      const result = await executeTool(
        'get_my_posts',
        { userId: ALICE_ID, limit: 5 },
        {
          userId: BOB_ID,
          supabase: mockSupabase,
        },
      )

      // The tool MUST query Bob ID, NOT Alice ID
      assert.equal(passedUserIdToDb, BOB_ID)
      assert.equal(result.posts.length, 1)
    })
  })

  describe('4. Write Actions Draft & Confirmation Requirements', () => {
    it('prepareCreateService produces a draft requiring explicit user confirmation', async () => {
      const draft = await prepareCreateService(BOB_ID, {
        name: 'Svetainių kūrimas',
        price: 50,
        priceType: 'from',
        description: 'Modernių svetainių kūrimas su Next.js',
      })

      assert.equal(draft.requiresConfirmation, true)
      assert.equal(draft.action, 'create_service')
      assert.equal(draft.status, 'draft')
      assert.equal(draft.draft?.name, 'Svetainių kūrimas')
      assert.equal(draft.draft?.price, 50)
      assert.equal(draft.draft?.price_type, 'from')
    })

    it('prepareCreatePost produces a post draft requiring explicit user confirmation', async () => {
      const draft = await prepareCreatePost(BOB_ID, 'Labas rytas visiems!')

      assert.equal(draft.requiresConfirmation, true)
      assert.equal(draft.action, 'create_post')
      assert.equal(draft.status, 'draft')
      assert.equal(draft.draft?.content, 'Labas rytas visiems!')
    })
  })
})
