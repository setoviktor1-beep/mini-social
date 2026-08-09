// Integration test for the reactions feature at the database layer.
//
// Verifies, against a real Postgres instance with all db/migrations applied,
// the properties that RLS/UI code depends on but can't verify itself:
//   - a user cannot hold two reactions on the same post (PK prevents it)
//   - a user cannot insert/update a reaction row for someone else (RLS)
//   - an unauthenticated ("anonymous") request cannot write a reaction (RLS)
//   - setting a 'like' reaction mirrors into the legacy `likes` table, and
//     switching away from 'like' removes the mirror row
//   - the likes/reactions cutover is safe: legacy direct writes to `likes`
//     are blocked for `authenticated` (rather than trying to reverse-sync
//     them into `reactions`, which would need recursion guards and leaves
//     an ambiguous conflict — see db/migrations/0008_reactions.sql for the
//     chosen-strategy rationale), so a legacy client can never diverge from
//     `reactions`, and a legacy delete can never touch an active non-'like'
//     reaction (it only ever affects the `likes` mirror row, which doesn't
//     exist for non-'like' reactions in the first place)
//
// Usage: DATABASE_URL=postgresql://... node scripts/test-reactions-db.mjs
// Run this against a throwaway/dev database only — it creates and deletes
// test rows. Never point it at production.

import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })

let failures = 0

function ok(description) {
  console.log(`  ok - ${description}`)
}

function fail(description, detail) {
  failures += 1
  console.error(`  FAIL - ${description}${detail ? `: ${detail}` : ''}`)
}

async function asUser(client, userId) {
  await client.query('SET LOCAL ROLE authenticated')
  await client.query(
    `SET LOCAL request.jwt.claims = '${JSON.stringify({ sub: userId, role: 'authenticated' })}'`,
  )
}

async function asAnonymous(client) {
  await client.query('SET LOCAL ROLE anonymous')
  await client.query("SET LOCAL request.jwt.claims = ''")
}

async function asService(client) {
  await client.query('SET LOCAL ROLE service_role')
  await client.query(
    `SET LOCAL request.jwt.claims = '${JSON.stringify({ role: 'service_role' })}'`,
  )
}

async function main() {
  const admin = await pool.connect()
  const userA = '11111111-1111-1111-1111-111111111111'
  const userB = '22222222-2222-2222-2222-222222222222'
  let postId

  try {
    // --- fixtures ---
    await admin.query('BEGIN')
    await admin.query(
      `INSERT INTO "user" (id, email, name) VALUES
         ($1, 'a@test.local', 'A'), ($2, 'b@test.local', 'B')
       ON CONFLICT (id) DO NOTHING`,
      [userA, userB],
    )
    await admin.query(
      `INSERT INTO profiles (id, username, display_name) VALUES
         ($1, 'reactiontesta', 'A'), ($2, 'reactiontestb', 'B')
       ON CONFLICT (id) DO NOTHING`,
      [userA, userB],
    )
    const postRes = await admin.query(
      `INSERT INTO posts (user_id, content) VALUES ($1, 'test post') RETURNING id`,
      [userA],
    )
    postId = postRes.rows[0].id
    await admin.query('COMMIT')

    // --- test 1: authorized insert succeeds, mirrors into likes ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userB)
        await client.query(
          `INSERT INTO reactions (user_id, post_id, type) VALUES ($1, $2, 'like')`,
          [userB, postId],
        )
        const likeRow = await client.query(
          `SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2`,
          [userB, postId],
        )
        if (likeRow.rowCount === 1) ok("insert 'like' reaction mirrors into legacy likes table")
        else fail("insert 'like' reaction mirrors into legacy likes table", 'no mirrored row found')
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        fail('authorized reaction insert', error.message)
      } finally {
        client.release()
      }
    }

    // --- test 2: duplicate reaction (second INSERT, same user+post) is rejected ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userB)
        await client.query(
          `INSERT INTO reactions (user_id, post_id, type) VALUES ($1, $2, 'love')`,
          [userB, postId],
        )
        fail('duplicate reaction insert is rejected', 'second INSERT unexpectedly succeeded')
        await client.query('ROLLBACK')
      } catch (error) {
        if (error.code === '23505') ok('duplicate reaction insert is rejected (unique_violation on primary key)')
        else fail('duplicate reaction insert is rejected', `unexpected error ${error.code}: ${error.message}`)
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }

    // --- test 3: switching reaction type via UPDATE removes the likes mirror ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userB)
        await client.query(
          `UPDATE reactions SET type = 'love' WHERE user_id = $1 AND post_id = $2`,
          [userB, postId],
        )
        const likeRow = await client.query(
          `SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2`,
          [userB, postId],
        )
        if (likeRow.rowCount === 0) ok("switching reaction away from 'like' removes the likes mirror row")
        else fail("switching reaction away from 'like' removes the likes mirror row", 'mirror row still present')
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        fail('reaction type switch', error.message)
      } finally {
        client.release()
      }
    }

    // --- test 4: RLS blocks inserting a reaction as a different user ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userA)
        await client.query(
          `INSERT INTO reactions (user_id, post_id, type) VALUES ($1, $2, 'wow')`,
          [userB, postId],
        )
        fail('RLS blocks reacting as another user', 'insert unexpectedly succeeded')
        await client.query('ROLLBACK')
      } catch (error) {
        if (error.code === '42501' || /row-level security/i.test(error.message)) {
          ok('RLS blocks reacting as another user')
        } else {
          fail('RLS blocks reacting as another user', `unexpected error ${error.code}: ${error.message}`)
        }
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }

    // --- test 5: anonymous (unauthenticated) cannot write a reaction ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asAnonymous(client)
        await client.query(
          `INSERT INTO reactions (user_id, post_id, type) VALUES ($1, $2, 'like')`,
          [userA, postId],
        )
        fail('anonymous cannot write a reaction', 'insert unexpectedly succeeded')
        await client.query('ROLLBACK')
      } catch (error) {
        ok('anonymous cannot write a reaction (rejected as expected)')
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }

    // --- cutover safety: `likes` has no reverse-sync trigger at all, so ---
    // --- recursion through a reactions<->likes trigger pair is structurally
    // --- impossible (there's only one direction: reactions -> likes) ---
    {
      const client = await pool.connect()
      try {
        const triggers = await client.query(
          `SELECT tgname FROM pg_trigger
           WHERE tgrelid = 'public.likes'::regclass AND NOT tgisinternal`,
        )
        if (triggers.rowCount === 0) {
          ok('likes has no triggers of its own — a reactions<->likes trigger loop cannot exist')
        } else {
          fail(
            'likes has no triggers of its own',
            `found trigger(s): ${triggers.rows.map((r) => r.tgname).join(', ')}`,
          )
        }
      } catch (error) {
        fail('likes has no triggers of its own', error.message)
      } finally {
        client.release()
      }
    }

    // --- cutover safety: a legacy direct INSERT into likes as `authenticated` ---
    // --- is rejected outright (not silently accepted and left to diverge) ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userA)
        await client.query(
          `INSERT INTO likes (user_id, post_id) VALUES ($1, $2)`,
          [userA, postId],
        )
        fail('legacy direct INSERT into likes is rejected', 'insert unexpectedly succeeded')
        await client.query('ROLLBACK')
      } catch (error) {
        if (error.code === '42501' || /permission denied/i.test(error.message)) {
          ok('legacy direct INSERT into likes is rejected (permission denied — authenticated has no write grant)')
        } else {
          fail('legacy direct INSERT into likes is rejected', `unexpected error ${error.code}: ${error.message}`)
        }
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }

    // --- cutover safety: a legacy direct DELETE from likes as `authenticated` ---
    // --- is rejected outright, so a legacy tab can never make a like ---
    // --- "reappear" by racing a delete against the reactions-driven mirror ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userB)
        await client.query(
          `DELETE FROM likes WHERE user_id = $1 AND post_id = $2`,
          [userB, postId],
        )
        fail('legacy direct DELETE from likes is rejected', 'delete unexpectedly succeeded')
        await client.query('ROLLBACK')
      } catch (error) {
        if (error.code === '42501' || /permission denied/i.test(error.message)) {
          ok('legacy direct DELETE from likes is rejected (permission denied — authenticated has no write grant)')
        } else {
          fail('legacy direct DELETE from likes is rejected', `unexpected error ${error.code}: ${error.message}`)
        }
        await client.query('ROLLBACK')
      } finally {
        client.release()
      }
    }

    // --- cutover safety: even service_role (which retains write access to ---
    // --- `likes` for operational use) deleting a `likes` row cannot touch ---
    // --- an active non-'like' reaction — `userB` is 'love' at this point ---
    // --- (from test 3) and has no `likes` row to begin with. ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asService(client)
        const deleted = await client.query(
          `DELETE FROM likes WHERE user_id = $1 AND post_id = $2`,
          [userB, postId],
        )
        const reactionRow = await client.query(
          `SELECT type FROM reactions WHERE user_id = $1 AND post_id = $2`,
          [userB, postId],
        )
        if (deleted.rowCount === 0 && reactionRow.rows[0]?.type === 'love') {
          ok("a likes delete cannot accidentally delete an active non-'like' reaction (no mirror row existed; reaction still 'love')")
        } else {
          fail(
            "a likes delete cannot accidentally delete an active non-'like' reaction",
            `deleted ${deleted.rowCount} likes row(s); reaction type is now ${reactionRow.rows[0]?.type ?? 'MISSING'}`,
          )
        }
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        fail("a likes delete cannot accidentally delete an active non-'like' reaction", error.message)
      } finally {
        client.release()
      }
    }
  } finally {
    // --- cleanup ---
    await admin.query('BEGIN')
    if (postId) await admin.query('DELETE FROM posts WHERE id = $1', [postId])
    await admin.query('DELETE FROM profiles WHERE id = ANY($1)', [[userA, userB]])
    await admin.query('DELETE FROM "user" WHERE id = ANY($1)', [[userA, userB]])
    await admin.query('COMMIT')
    admin.release()
    await pool.end()
  }

  console.log('')
  if (failures > 0) {
    console.error(`${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('All reaction integration checks passed')
}

main().catch((error) => {
  console.error('Test run crashed:', error)
  process.exit(1)
})
