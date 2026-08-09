// Unit tests for the parts of lib/ai/openrouter.ts that don't require a
// live OPENROUTER_API_KEY (none is configured in this environment yet —
// see docs/ai-composer.md). Covers the "AI unavailable" fallback path,
// which every route/UI consumer depends on to degrade gracefully.

import { test } from 'node:test'
import assert from 'node:assert/strict'

test('isAiConfigured() is false when OPENROUTER_API_KEY is unset', async () => {
  delete process.env.OPENROUTER_API_KEY
  const { isAiConfigured } = await import('../../lib/ai/openrouter')
  assert.equal(isAiConfigured(), false)
})

test('chatCompletion() throws AiUnavailableError (not a raw network error) when unconfigured', async () => {
  delete process.env.OPENROUTER_API_KEY
  const { chatCompletion, AiUnavailableError } = await import('../../lib/ai/openrouter')
  await assert.rejects(
    () => chatCompletion({ system: 'test', user: 'hello' }),
    AiUnavailableError,
  )
})

test('getModelName() defaults to the configured Nemotron slug when OPENROUTER_MODEL is unset', async () => {
  delete process.env.OPENROUTER_MODEL
  const { getModelName } = await import('../../lib/ai/openrouter')
  assert.equal(getModelName(), 'nvidia/nemotron-3-ultra-550b-a55b:free')
})

test('getModelName() respects an OPENROUTER_MODEL override', async () => {
  process.env.OPENROUTER_MODEL = 'some/other-model:free'
  // Re-import isn't needed — getModelName() reads process.env at call time.
  const { getModelName } = await import('../../lib/ai/openrouter')
  assert.equal(getModelName(), 'some/other-model:free')
  delete process.env.OPENROUTER_MODEL
})

test('isAiConfigured() is true once OPENROUTER_API_KEY is set', async () => {
  process.env.OPENROUTER_API_KEY = 'test-key-for-unit-test'
  const { isAiConfigured } = await import('../../lib/ai/openrouter')
  assert.equal(isAiConfigured(), true)
  delete process.env.OPENROUTER_API_KEY
})
