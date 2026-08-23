import { test, describe, before, after } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { SignJWT } from 'jose'
import { verifyOrGetThreadOwnership, assertValidUserId } from '../../lib/ai/security/isolation'
import { checkResourceAccess } from '../../lib/ai/permissions'

const { Pool } = pg

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@127.0.0.1:15433/mini_social_test'
const POSTGREST_URL = process.env.POSTGREST_URL || 'http://127.0.0.1:13000'
const JWT_SECRET =
  process.env.POSTGREST_JWT_SECRET || 'test-jwt-secret-please-be-at-least-32-chars-long'

// Deterministic test UUIDs for Alice & Bob
const ALICE_ID = '11111111-1111-4111-8111-111111111111'
const BOB_ID = '22222222-2222-4222-8222-222222222222'

const ALICE_THREAD_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BOB_THREAD_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

const ALICE_MSG_ID = 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a1'
const BOB_MSG_ID = 'b1b1b1b1-b1b1-41b1-81b1-b1b1b1b1b1b1'

const ALICE_SECRET = 'TEST_SECRET_ALICE_7F39'
const BOB_SECRET = 'TEST_SECRET_BOB_99AA'

async function createJwt(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(JWT_SECRET)
  return new SignJWT({
    role: 'authenticated',
    sub: userId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(secret)
}

describe('Real PostgreSQL + PostgREST AI Privacy & RLS Integration (P0 Release Blocker)', () => {
  let pool: pg.Pool
  let aliceToken: string
  let bobToken: string

  before(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 5 })
    aliceToken = await createJwt(ALICE_ID)
    bobToken = await createJwt(BOB_ID)

    const client = await pool.connect()
    try {
      // 1. Ensure test users exist in public."user" and public.profiles
      await client.query(`
        INSERT INTO public."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
        VALUES 
          ('${ALICE_ID}', 'Alice', 'alice@test.local', true, now(), now()),
          ('${BOB_ID}', 'Bob', 'bob@test.local', true, now(), now())
        ON CONFLICT (id) DO UPDATE SET "updatedAt" = now();
      `)

      await client.query(`
        INSERT INTO public.profiles (id, username, display_name, created_at)
        VALUES 
          ('${ALICE_ID}', 'alice_test', 'Alice Test', now()),
          ('${BOB_ID}', 'bob_test', 'Bob Test', now())
        ON CONFLICT (id) DO NOTHING;
      `)

      // Clean up any previous test AI records
      await client.query(`
        DELETE FROM public.ai_messages WHERE conversation_id IN ('${ALICE_THREAD_ID}', '${BOB_THREAD_ID}');
        DELETE FROM public.ai_conversations WHERE id IN ('${ALICE_THREAD_ID}', '${BOB_THREAD_ID}');
        DELETE FROM public.ai_memory WHERE user_id IN ('${ALICE_ID}', '${BOB_ID}');
        DELETE FROM public.ai_usage_logs WHERE user_id IN ('${ALICE_ID}', '${BOB_ID}');
      `)

      // 2. Insert Alice's private data
      await client.query(`
        INSERT INTO public.ai_conversations (id, user_id, title)
        VALUES ('${ALICE_THREAD_ID}', '${ALICE_ID}', 'Alice Secret AI Discussion');

        INSERT INTO public.ai_messages (id, conversation_id, user_id, role, content)
        VALUES ('${ALICE_MSG_ID}', '${ALICE_THREAD_ID}', '${ALICE_ID}', 'user', 'My secret key is ${ALICE_SECRET}');

        INSERT INTO public.ai_memory (user_id, memory)
        VALUES ('${ALICE_ID}', '{"secret_note": "${ALICE_SECRET}"}'::jsonb);
      `)

      // 3. Insert Bob's private data
      await client.query(`
        INSERT INTO public.ai_conversations (id, user_id, title)
        VALUES ('${BOB_THREAD_ID}', '${BOB_ID}', 'Bob AI Discussion');

        INSERT INTO public.ai_messages (id, conversation_id, user_id, role, content)
        VALUES ('${BOB_MSG_ID}', '${BOB_THREAD_ID}', '${BOB_ID}', 'user', 'My secret key is ${BOB_SECRET}');

        INSERT INTO public.ai_memory (user_id, memory)
        VALUES ('${BOB_ID}', '{"secret_note": "${BOB_SECRET}"}'::jsonb);
      `)
    } finally {
      client.release()
    }
  })

  after(async () => {
    if (pool) {
      const client = await pool.connect()
      try {
        await client.query(`
          DELETE FROM public.ai_messages WHERE conversation_id IN ('${ALICE_THREAD_ID}', '${BOB_THREAD_ID}');
          DELETE FROM public.ai_conversations WHERE id IN ('${ALICE_THREAD_ID}', '${BOB_THREAD_ID}');
          DELETE FROM public.ai_memory WHERE user_id IN ('${ALICE_ID}', '${BOB_ID}');
          DELETE FROM public.ai_usage_logs WHERE user_id IN ('${ALICE_ID}', '${BOB_ID}');
        `)
      } finally {
        client.release()
        await pool.end()
      }
    }
  })

  test('1. Bob CANNOT SELECT Alice ai_conversations (0 rows via Postgres RLS & PostgREST)', async () => {
    // 1.1 Direct PostgreSQL with Bob's authenticated claims
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )
      const res = await client.query(`SELECT * FROM public.ai_conversations WHERE id = '${ALICE_THREAD_ID}'`)
      await client.query('ROLLBACK')
      assert.equal(res.rowCount, 0, 'PostgreSQL RLS must return 0 rows for foreign conversation')
    } finally {
      client.release()
    }

    // 1.2 Via PostgREST with Bob's JWT
    const pgrstRes = await fetch(`${POSTGREST_URL}/ai_conversations?id=eq.${ALICE_THREAD_ID}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    const pgrstData = await pgrstRes.json()
    assert.equal(Array.isArray(pgrstData) ? pgrstData.length : 0, 0)
    assert.doesNotMatch(JSON.stringify(pgrstData), new RegExp(ALICE_SECRET))
  })

  test('2. Bob CANNOT SELECT Alice ai_messages (0 rows, Alice secret never exposed)', async () => {
    // 2.1 Direct Postgres
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )
      const res = await client.query(`SELECT * FROM public.ai_messages WHERE conversation_id = '${ALICE_THREAD_ID}'`)
      await client.query('ROLLBACK')
      assert.equal(res.rowCount, 0, 'PostgreSQL RLS must return 0 rows for foreign messages')
    } finally {
      client.release()
    }

    // 2.2 PostgREST
    const pgrstRes = await fetch(`${POSTGREST_URL}/ai_messages?conversation_id=eq.${ALICE_THREAD_ID}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    const pgrstData = await pgrstRes.json()
    assert.equal(Array.isArray(pgrstData) ? pgrstData.length : 0, 0)
    assert.doesNotMatch(JSON.stringify(pgrstData), new RegExp(ALICE_SECRET))
  })

  test('3. Bob CANNOT SELECT Alice ai_memory (0 rows, zero leak)', async () => {
    // 3.1 Direct Postgres
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )
      const res = await client.query(`SELECT * FROM public.ai_memory WHERE user_id = '${ALICE_ID}'`)
      await client.query('ROLLBACK')
      assert.equal(res.rowCount, 0, 'PostgreSQL RLS must return 0 rows for foreign memory')
    } finally {
      client.release()
    }

    // 3.2 PostgREST
    const pgrstRes = await fetch(`${POSTGREST_URL}/ai_memory?user_id=eq.${ALICE_ID}`, {
      headers: { Authorization: `Bearer ${bobToken}` },
    })
    const pgrstData = await pgrstRes.json()
    assert.equal(Array.isArray(pgrstData) ? pgrstData.length : 0, 0)
    assert.doesNotMatch(JSON.stringify(pgrstData), new RegExp(ALICE_SECRET))
  })

  test('4. Bob CANNOT SELECT Alice via legacy ai_threads view (Dropped / denied)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )
      // View was dropped in favor of direct ai_conversations table
      const res = await client
        .query(`SELECT * FROM public.ai_threads WHERE id = '${ALICE_THREAD_ID}'`)
        .catch((err) => ({ error: err, rowCount: 0 }))

      if ('error' in res && res.error) {
        assert.match(res.error.message, /relation.*ai_threads.*does not exist/i)
      } else {
        assert.equal(res.rowCount, 0)
      }
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  test('5. Bob CANNOT UPDATE Alice thread (0 rows affected)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )
      const res = await client.query(
        `UPDATE public.ai_conversations SET title = 'Hacked by Bob' WHERE id = '${ALICE_THREAD_ID}'`,
      )
      await client.query('ROLLBACK')
      assert.equal(res.rowCount, 0, 'Must affect 0 rows')
    } finally {
      client.release()
    }
  })

  test('6. Bob CANNOT DELETE Alice thread (0 rows affected)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )
      const res = await client.query(`DELETE FROM public.ai_conversations WHERE id = '${ALICE_THREAD_ID}'`)
      await client.query('ROLLBACK')
      assert.equal(res.rowCount, 0, 'Must affect 0 rows')
    } finally {
      client.release()
    }
  })

  test('7. Bob CANNOT INSERT message into Alice thread (RLS WITH CHECK violation)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )

      await assert.rejects(
        () =>
          client.query(`
            INSERT INTO public.ai_messages (conversation_id, user_id, role, content)
            VALUES ('${ALICE_THREAD_ID}', '${BOB_ID}', 'user', 'Injected message by Bob');
          `),
        (err: any) => {
          // 42501 is PostgreSQL RLS policy violation
          assert.equal(err.code, '42501')
          return true
        },
      )
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  test('8. Bob CANNOT INSERT conversation with user_id = Alice (RLS WITH CHECK violation)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )

      await assert.rejects(
        () =>
          client.query(`
            INSERT INTO public.ai_conversations (user_id, title)
            VALUES ('${ALICE_ID}', 'Forged conversation by Bob');
          `),
        (err: any) => {
          assert.equal(err.code, '42501')
          return true
        },
      )
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  test('9. Bob CANNOT UPDATE own message user_id to Alice (RLS WITH CHECK violation)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )

      await assert.rejects(
        () =>
          client.query(`
            UPDATE public.ai_messages 
            SET user_id = '${ALICE_ID}'
            WHERE id = '${BOB_MSG_ID}';
          `),
        (err: any) => {
          assert.equal(err.code, '42501')
          return true
        },
      )
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  test('10. Bob CANNOT INSERT usage logs with user_id = Alice (RLS WITH CHECK violation)', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: BOB_ID, role: 'authenticated' })}'`,
      )

      await assert.rejects(
        () =>
          client.query(`
            INSERT INTO public.ai_usage_logs (user_id, provider, model, action)
            VALUES ('${ALICE_ID}', 'omnirouter', 'gemini-3.5-flash-lite', 'chat');
          `),
        (err: any) => {
          assert.equal(err.code, '42501')
          return true
        },
      )
      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  test('11. Reverse Alice -> Bob isolation: Alice CANNOT read or mutate Bob data', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SET LOCAL ROLE authenticated')
      await client.query(
        `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: ALICE_ID, role: 'authenticated' })}'`,
      )

      // Alice tries to read Bob thread
      const res1 = await client.query(`SELECT * FROM public.ai_conversations WHERE id = '${BOB_THREAD_ID}'`)
      assert.equal(res1.rowCount, 0)

      // Alice tries to read Bob messages
      const res2 = await client.query(`SELECT * FROM public.ai_messages WHERE conversation_id = '${BOB_THREAD_ID}'`)
      assert.equal(res2.rowCount, 0)

      // Alice tries to read Bob memory
      const res3 = await client.query(`SELECT * FROM public.ai_memory WHERE user_id = '${BOB_ID}'`)
      assert.equal(res3.rowCount, 0)

      // Alice tries to update Bob thread
      const res4 = await client.query(`UPDATE public.ai_conversations SET title = 'Hacked' WHERE id = '${BOB_THREAD_ID}'`)
      assert.equal(res4.rowCount, 0)

      // Alice tries to insert message into Bob thread
      await assert.rejects(
        () =>
          client.query(`
            INSERT INTO public.ai_messages (conversation_id, user_id, role, content)
            VALUES ('${BOB_THREAD_ID}', '${ALICE_ID}', 'user', 'Injected by Alice');
          `),
        (err: any) => {
          assert.equal(err.code, '42501')
          return true
        },
      )

      await client.query('ROLLBACK')
    } finally {
      client.release()
    }
  })

  test('12. Direct private messages access remains strictly disabled', () => {
    assert.throws(
      () => checkResourceAccess('messages'),
      (err: any) => {
        assert.equal(err.code, 'AI_FORBIDDEN')
        return true
      },
    )
    assert.throws(
      () => checkResourceAccess('direct_messages'),
      (err: any) => {
        assert.equal(err.code, 'AI_FORBIDDEN')
        return true
      },
    )
  })
})
