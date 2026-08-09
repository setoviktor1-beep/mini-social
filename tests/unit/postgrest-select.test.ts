// Regression tests for lib/backend/postgrest.ts's normalizeSelect().
//
// Context: PostgREST's select-parameter grammar fails to parse whitespace
// immediately after '(' (and, in practice, literal newlines anywhere in the
// string) — it doesn't error, it silently mis-parses and returns flat rows
// with embeds dropped. This app writes most non-trivial `select` strings as
// multi-line template literals, so the bug was live across the app until
// normalizeSelect() was introduced. These tests pin down the exact
// behavior so a future refactor can't reintroduce the regression.
//
// Run with: npx tsx --test tests/unit/postgrest-select.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSelect } from '../../lib/backend/postgrest'

test('strips a multiline select string down to a single line with no whitespace', () => {
  const multiline = `
    created_at,
    post:posts!bookmarks_post_id_fkey(
      *,
      profiles:user_id(username, display_name, avatar_path)
    )
  `
  const result = normalizeSelect(multiline)
  assert.equal(result.includes('\n'), false)
  assert.equal(/\s/.test(result), false)
  assert.equal(
    result,
    'created_at,post:posts!bookmarks_post_id_fkey(*,profiles:user_id(username,display_name,avatar_path))',
  )
})

test('removes spaces and line breaks around parentheses specifically', () => {
  // This is the exact shape that broke PostgREST: a newline/space directly
  // after '(' or directly before ')'.
  const withParenWhitespace = 'post:posts!fkey(\n  *,\n  id\n)'
  assert.equal(normalizeSelect(withParenWhitespace), 'post:posts!fkey(*,id)')

  const spacedParens = 'post:posts!fkey( *, id )'
  assert.equal(normalizeSelect(spacedParens), 'post:posts!fkey(*,id)')
})

test('removes whitespace around commas at every nesting depth', () => {
  const input = 'a , b(  c ,  d(e , f)  , g )  , h'
  assert.equal(normalizeSelect(input), 'a,b(c,d(e,f),g),h')
})

test('preserves nested embeds structurally (parens/commas/colons untouched, only whitespace removed)', () => {
  const input = `
    post:posts!bookmarks_post_id_fkey(
      *,
      profiles:user_id(username, display_name, avatar_path),
      post_media(storage_path)
    )
  `
  const result = normalizeSelect(input)
  // Same nesting depth: 3 opens / 3 closes, all in the original relative order.
  assert.equal((result.match(/\(/g) || []).length, 3)
  assert.equal((result.match(/\)/g) || []).length, 3)
  assert.equal(
    result,
    'post:posts!bookmarks_post_id_fkey(*,profiles:user_id(username,display_name,avatar_path),post_media(storage_path))',
  )
})

test('preserves alias:table!fkey syntax exactly', () => {
  const input = `
    reposter : profiles!reposts_user_id_fkey (
      id, username, display_name, avatar_path
    )
  `
  // (Deliberately includes stray spaces around ':' and '!' too — PostgREST
  // doesn't allow those either, and real code never emits them, but the
  // normalizer must not special-case position: it strips ALL whitespace.)
  assert.equal(
    normalizeSelect(input),
    'reposter:profiles!reposts_user_id_fkey(id,username,display_name,avatar_path)',
  )
})

test('preserves the quoted_post nested relationship embed used across the feed', () => {
  const input = `
    quoted_post:quoted_post_id(
      id,
      content,
      youtube_video_id,
      created_at,
      status,
      profiles:user_id(username, display_name, avatar_path),
      post_media(storage_path)
    )
  `
  const result = normalizeSelect(input)
  assert.equal(
    result,
    'quoted_post:quoted_post_id(id,content,youtube_video_id,created_at,status,profiles:user_id(username,display_name,avatar_path),post_media(storage_path))',
  )
})

test('preserves reaction/comment/repost count embeds', () => {
  const input = `
    reactions(count),
    comments(count),
    reposts(count)
  `
  assert.equal(normalizeSelect(input), 'reactions(count),comments(count),reposts(count)')
})

test('a compact select and its multiline equivalent normalize to the same string', () => {
  const compact =
    'created_at,post:posts!bookmarks_post_id_fkey(*,profiles:user_id(username,display_name,avatar_path),post_media(storage_path),quoted_post:quoted_post_id(id,content,youtube_video_id,created_at,status,profiles:user_id(username,display_name,avatar_path),post_media(storage_path)),reactions(count),comments(count),reposts(count))'

  const multiline = `
      created_at,
      post:posts!bookmarks_post_id_fkey(
        *,
        profiles:user_id(username, display_name, avatar_path),
        post_media(storage_path),
        quoted_post:quoted_post_id(
          id,
          content,
          youtube_video_id,
          created_at,
          status,
          profiles:user_id(username, display_name, avatar_path),
          post_media(storage_path)
        ),
        reactions(count),
        comments(count),
        reposts(count)
      )
    `

  assert.equal(normalizeSelect(compact), compact, 'an already-compact select must be left byte-identical')
  assert.equal(normalizeSelect(multiline), normalizeSelect(compact))
  assert.equal(normalizeSelect(multiline), compact)
})

test('does not alter legitimate non-whitespace query content', () => {
  // Field names, operators inside filter-like fragments, casts, wildcards,
  // and numeric/text content must survive untouched — only whitespace
  // characters are removed, nothing is reordered or rewritten.
  const cases: Array<[string, string]> = [
    ['*', '*'],
    ['id,content,youtube_url,youtube_video_id', 'id,content,youtube_url,youtube_video_id'],
    ['created_at::date', 'created_at::date'],
    ['count()', 'count()'],
    ['a_b_c,d1,e_2', 'a_b_c,d1,e_2'],
  ]
  for (const [input, expected] of cases) {
    assert.equal(normalizeSelect(input), expected)
  }
})

test('is idempotent (normalizing an already-normalized select is a no-op)', () => {
  const once = normalizeSelect('created_at,\n  post:posts!fkey(*, id)')
  const twice = normalizeSelect(once)
  assert.equal(once, twice)
})
