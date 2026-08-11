// Unit tests for lib/mentions.ts's detectMentionTrigger() (the composer's
// @-mention autocomplete trigger detection) and the existing
// extractMentionUsernames()/notifyMentions() notification-creation path.
//
// Run with: npx tsx --test tests/unit/mentions.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectMentionTrigger, extractMentionUsernames, notifyMentions } from '../../lib/mentions'

// --- detectMentionTrigger ---------------------------------------------

test('detectMentionTrigger activates right after a bare @', () => {
  const result = detectMentionTrigger('Hello @', 7)
  assert.deepEqual(result, { start: 6, end: 7, query: '' })
});

test('detectMentionTrigger activates with a partial query typed', () => {
  const result = detectMentionTrigger('Hello @vik', 10)
  assert.deepEqual(result, { start: 6, end: 10, query: 'vik' })
});

test('detectMentionTrigger returns null when there is no @ before the cursor', () => {
  assert.equal(detectMentionTrigger('Hello world', 11), null)
});

test('detectMentionTrigger does not trigger mid-word for an email-like pattern (user@example.com)', () => {
  // Cursor right after "user@example" — the '@' is preceded by a word
  // character ('r' in "user"), so this must not be treated as a mention.
  const text = 'user@example.com'
  const cursor = text.indexOf('example') + 'example'.length
  assert.equal(detectMentionTrigger(text, cursor), null)
});

test('detectMentionTrigger only considers the trigger nearest the cursor, not an earlier @ in the text', () => {
  const text = '@alice hello @bob'
  const cursor = text.length // cursor at the very end, inside "@bob"
  const result = detectMentionTrigger(text, cursor)
  assert.equal(result?.query, 'bob')
  assert.equal(text.slice(result!.start, result!.end), '@bob')
});

test('detectMentionTrigger closes once a space breaks the word after @', () => {
  const text = '@alice '
  assert.equal(detectMentionTrigger(text, text.length), null)
});

test('detectMentionTrigger works when the cursor is in the middle of the document, not just at the end', () => {
  const text = 'Hey @alice how are you'
  const cursor = '@alice'.length + 'Hey '.length // right after "alice"
  const result = detectMentionTrigger(text, cursor)
  assert.equal(result?.query, 'alice')
});

test('detectMentionTrigger rejects an out-of-range cursor rather than throwing', () => {
  assert.equal(detectMentionTrigger('hello', -1), null)
  assert.equal(detectMentionTrigger('hello', 999), null)
});

// --- notifyMentions: blocked users must not receive a mention notification ---
//
// The composer's autocomplete already excludes blocked users from
// suggestions (server-side, app/api/mentions/search/route.ts) — but a
// mention notification is also created from raw @username text on submit
// (this module), independent of whether the username came from
// autocomplete or was typed by hand. That path must also not notify
// someone who blocked the poster (or vice versa), since a blocked
// relationship should not be bypassable just by typing the username
// directly instead of selecting it from suggestions.

function fakeSupabase(profiles: { id: string; username: string }[]) {
  const inserted: any[] = []
  return {
    inserted,
    from(table: string) {
      if (table === 'profiles') {
        return {
          select() { return this },
          in(_col: string, usernames: string[]) {
            return Promise.resolve({
              data: profiles.filter((p) => usernames.includes(p.username)),
            })
          },
        }
      }
      if (table === 'notifications') {
        return {
          insert(rows: any[]) {
            inserted.push(...rows)
            return Promise.resolve({ data: null, error: null })
          },
        }
      }
      throw new Error(`unexpected table ${table}`)
    },
  }
}

test('notifyMentions creates a notification for a mentioned, non-excluded user', async () => {
  const supabase = fakeSupabase([{ id: 'user-b', username: 'bob' }])
  await notifyMentions({
    supabase: supabase as any,
    content: 'hey @bob check this out',
    actorId: 'user-a',
    targetId: 'post-1',
    targetType: 'post',
  })
  assert.equal(supabase.inserted.length, 1)
  assert.equal(supabase.inserted[0].user_id, 'user-b')
  assert.equal(supabase.inserted[0].type, 'mention')
});

test('notifyMentions does not notify a user in excludeUserIds (e.g. a blocked relationship)', async () => {
  const supabase = fakeSupabase([{ id: 'user-b', username: 'bob' }])
  await notifyMentions({
    supabase: supabase as any,
    content: 'hey @bob check this out',
    actorId: 'user-a',
    targetId: 'post-1',
    targetType: 'post',
    excludeUserIds: ['user-b'],
  })
  assert.equal(supabase.inserted.length, 0)
});

test('notifyMentions never notifies the poster mentioning themselves', async () => {
  const supabase = fakeSupabase([{ id: 'user-a', username: 'alice' }])
  await notifyMentions({
    supabase: supabase as any,
    content: 'reminding myself @alice',
    actorId: 'user-a',
    targetId: 'post-1',
    targetType: 'post',
  })
  assert.equal(supabase.inserted.length, 0)
});

test('extractMentionUsernames deduplicates and lowercases', () => {
  const usernames = extractMentionUsernames('@Bob hi @bob and @Alice')
  assert.deepEqual(usernames.sort(), ['alice', 'bob'])
});
