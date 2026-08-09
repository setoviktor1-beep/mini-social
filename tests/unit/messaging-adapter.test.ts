// Unit tests for the messaging adapter selector (lib/messaging). Pure
// logic only — legacy-adapter.ts needs a live Postgres/PostgREST session
// to actually send/list messages (covered by manual/integration testing
// of app/messages itself, unchanged by this phase), but the selector
// logic and the matrix stub's "fail loudly" behavior are fully testable
// without any infrastructure.

import { test } from 'node:test'
import assert from 'node:assert/strict'

// lib/backend-server.ts transitively imports lib/auth.ts, which calls
// betterAuth({ database: getPool(), ... }) at module load time — getPool()
// throws immediately if DATABASE_URL is unset, even though nothing in
// these tests ever executes a query. Set a placeholder so the module graph
// can load; Pool's constructor doesn't connect eagerly, so this is safe.
process.env.DATABASE_URL ||= 'postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder'
process.env.BETTER_AUTH_SECRET ||= 'placeholder-secret-at-least-32-characters-long'

test('isE2eeMessagingEnabled() is false by default (unset)', async () => {
  delete process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED
  const { isE2eeMessagingEnabled } = await import('../../lib/messaging/adapter')
  assert.equal(isE2eeMessagingEnabled(), false)
})

test('isE2eeMessagingEnabled() is false for any value other than the literal string "true"', async () => {
  const { isE2eeMessagingEnabled } = await import('../../lib/messaging/adapter')
  for (const value of ['1', 'yes', 'TRUE', 'false', '']) {
    process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED = value
    assert.equal(isE2eeMessagingEnabled(), false, `expected false for "${value}"`)
  }
  delete process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED
})

test('isE2eeMessagingEnabled() is true only when explicitly set to "true"', async () => {
  process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED = 'true'
  const { isE2eeMessagingEnabled } = await import('../../lib/messaging/adapter')
  assert.equal(isE2eeMessagingEnabled(), true)
  delete process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED
})

test('getMessagingAdapter() returns the legacy adapter by default', async () => {
  delete process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED
  const { getMessagingAdapter } = await import('../../lib/messaging/index')
  const adapter = getMessagingAdapter()
  assert.equal(adapter.name, 'legacy-postgres')
  assert.equal(adapter.providesEndToEndEncryption, false)
})

test('getMessagingAdapter() returns the (stub) matrix adapter when the flag is enabled', async () => {
  process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED = 'true'
  const { getMessagingAdapter } = await import('../../lib/messaging/index')
  const adapter = getMessagingAdapter()
  assert.equal(adapter.name, 'matrix-e2ee')
  assert.equal(adapter.providesEndToEndEncryption, true)
  delete process.env.NEXT_PUBLIC_E2EE_MESSAGING_ENABLED
})

test('every matrix adapter method fails loudly instead of silently no-op-ing', async () => {
  const { matrixAdapter } = await import('../../lib/messaging/matrix-adapter')
  const { MatrixNotConfiguredError } = await import('../../lib/messaging/matrix-adapter')

  await assert.rejects(() => matrixAdapter.listConversations('u1'), MatrixNotConfiguredError)
  await assert.rejects(() => matrixAdapter.getOrCreateConversation('u1', 'u2'), MatrixNotConfiguredError)
  await assert.rejects(() => matrixAdapter.listMessages('c1'), MatrixNotConfiguredError)
  await assert.rejects(() => matrixAdapter.sendMessage('c1', 'u1', 'hi'), MatrixNotConfiguredError)
  await assert.rejects(() => matrixAdapter.markRead('c1', 'u1'), MatrixNotConfiguredError)
})

test('legacy adapter never claims end-to-end encryption', async () => {
  const { legacyAdapter } = await import('../../lib/messaging/legacy-adapter')
  assert.equal(legacyAdapter.providesEndToEndEncryption, false)
})
