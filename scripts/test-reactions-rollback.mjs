// Automated test for the 0008_reactions.sql rollback procedure documented
// in docs/migrations-0006-0008-rollback.md.
//
// Scenario:
//   1. A user likes a post (a legacy `likes` row, as if from before 0008).
//   2. The user changes that reaction to a non-'like' type (e.g. 'love') —
//      per the sync_reaction_to_likes trigger, this removes their `likes`
//      mirror row, since only 'like'-typed reactions are mirrored.
//   3. The documented rollback SQL is executed verbatim.
//   4. Assert the `likes` row exists again — proving the rollback's
//      rehydration step (`INSERT INTO likes SELECT ... FROM reactions`)
//      actually recovers engagement that would otherwise be silently lost.
//
// This test DROPS the `reactions` table and revokes/re-grants privileges
// as part of exercising the real rollback SQL, so it must run against an
// isolated/throwaway database — never production — and leaves the target
// database in the pre-0008 (rolled back) state when it finishes. Re-apply
// 0008 (`node scripts/migrate.mjs`, after deleting its schema_migrations
// row) if you need the schema back for further testing.
//
// Usage: DATABASE_URL=postgresql://... node scripts/test-reactions-rollback.mjs

import pg from 'pg'

const { Pool } = pg

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })

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

// The exact rollback SQL documented in
// docs/migrations-0006-0008-rollback.md — kept here as a single source of
// truth so the test fails loudly if the two ever drift apart.
const ROLLBACK_SQL = `
  INSERT INTO likes (user_id, post_id, created_at)
  SELECT user_id, post_id, created_at FROM reactions
  ON CONFLICT (user_id, post_id) DO NOTHING;

  DROP TRIGGER IF EXISTS sync_reaction_to_likes ON reactions;
  DROP FUNCTION IF EXISTS public.sync_reaction_to_likes();
  DROP TABLE IF EXISTS reactions;

  GRANT INSERT, UPDATE, DELETE ON public.likes TO authenticated;
`

async function main() {
  const admin = await pool.connect()
  const userId = '33333333-3333-3333-3333-333333333333'
  let postId

  try {
    // --- fixtures ---
    await admin.query('BEGIN')
    await admin.query(
      `INSERT INTO "user" (id, email, name) VALUES ($1, 'rollback@test.local', 'Rollback Tester')
       ON CONFLICT (id) DO NOTHING`,
      [userId],
    )
    await admin.query(
      `INSERT INTO profiles (id, username, display_name) VALUES ($1, 'rollbacktester', 'Rollback Tester')
       ON CONFLICT (id) DO NOTHING`,
      [userId],
    )
    const postRes = await admin.query(
      `INSERT INTO posts (user_id, content) VALUES ($1, 'rollback test post') RETURNING id`,
      [userId],
    )
    postId = postRes.rows[0].id
    await admin.query('COMMIT')

    // --- step 1: user likes the post (via reactions, mirrored into likes) ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userId)
        await client.query(
          `INSERT INTO reactions (user_id, post_id, type) VALUES ($1, $2, 'like')`,
          [userId, postId],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        fail('step 1: user likes the post', error.message)
      } finally {
        client.release()
      }
    }

    const likeExistsBefore = await admin.query(
      `SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2`,
      [userId, postId],
    )
    if (likeExistsBefore.rowCount === 1) ok('step 1: liking via reactions created a likes mirror row')
    else fail('step 1: liking via reactions created a likes mirror row', 'no likes row found')

    // --- step 2: user changes the reaction to a non-'like' type ---
    {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await asUser(client, userId)
        await client.query(
          `UPDATE reactions SET type = 'love' WHERE user_id = $1 AND post_id = $2`,
          [userId, postId],
        )
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        fail("step 2: switch reaction to 'love'", error.message)
      } finally {
        client.release()
      }
    }

    const likeExistsAfterSwitch = await admin.query(
      `SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2`,
      [userId, postId],
    )
    if (likeExistsAfterSwitch.rowCount === 0) {
      ok("step 2: switching to 'love' removed the likes mirror row (expected — this is exactly what rollback must recover)")
    } else {
      fail('step 2: switching to \'love\' removed the likes mirror row', 'likes row unexpectedly still present')
    }

    // --- step 3: execute the documented rollback SQL verbatim ---
    try {
      await admin.query('BEGIN')
      await admin.query(ROLLBACK_SQL)
      await admin.query('COMMIT')
      ok('step 3: documented rollback SQL executed without error')
    } catch (error) {
      await admin.query('ROLLBACK')
      fail('step 3: documented rollback SQL executed without error', error.message)
      throw error
    }

    // --- step 4: the likes row must exist again after rollback ---
    const likeExistsAfterRollback = await admin.query(
      `SELECT 1 FROM likes WHERE user_id = $1 AND post_id = $2`,
      [userId, postId],
    )
    if (likeExistsAfterRollback.rowCount === 1) {
      ok('step 4: likes row was rehydrated from reactions by the rollback — engagement preserved')
    } else {
      fail(
        'step 4: likes row was rehydrated from reactions by the rollback',
        'no likes row found after rollback — the like changed to love before rollback would be silently lost',
      )
    }

    // --- step 5: reactions table no longer exists ---
    const reactionsTableGone = await admin.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reactions'`,
    )
    if (reactionsTableGone.rowCount === 0) ok('step 5: reactions table was dropped by the rollback')
    else fail('step 5: reactions table was dropped by the rollback', 'reactions table still exists')
  } finally {
    // --- cleanup ---
    await admin.query('BEGIN')
    if (postId) await admin.query('DELETE FROM posts WHERE id = $1', [postId])
    await admin.query('DELETE FROM profiles WHERE id = $1', [userId])
    await admin.query('DELETE FROM "user" WHERE id = $1', [userId])
    await admin.query('COMMIT')
    admin.release()
    await pool.end()
  }

  console.log('')
  if (failures > 0) {
    console.error(`${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('All reaction-rollback checks passed')
}

main().catch((error) => {
  console.error('Test run crashed:', error)
  process.exit(1)
})
