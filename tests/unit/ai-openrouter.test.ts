// Unit tests for the parts of lib/ai/openrouter.ts that don't require a
// live API key. Covers the "AI unavailable" fallback path,
// which every route/UI consumer depends on to degrade gracefully.

import { test } from 'node:test'
import assert from 'node:assert/strict'

test('isAiConfigured() is false when OMNIROUTER_API_KEY or OMNIROUTER_BASE_URL is unset', async () => {
  delete process.env.OMNIROUTER_API_KEY
  delete process.env.OMNIROUTER_BASE_URL
  delete process.env.OPENROUTER_API_KEY
  const { isAiConfigured } = await import('../../lib/ai/openrouter')
  assert.equal(isAiConfigured(), false)
})

test('chatCompletion() throws AiUnavailableError (not a raw network error) when unconfigured', async () => {
  delete process.env.OMNIROUTER_API_KEY
  delete process.env.OMNIROUTER_BASE_URL
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
  const { getModelName } = await import('../../lib/ai/openrouter')
  assert.equal(getModelName(), 'some/other-model:free')
  delete process.env.OPENROUTER_MODEL
})

test('isAiConfigured() is true once OMNIROUTER_API_KEY and OMNIROUTER_BASE_URL are set', async () => {
  process.env.OMNIROUTER_API_KEY = 'test-key-for-unit-test'
  process.env.OMNIROUTER_BASE_URL = 'https://api.omnirouter.ai/v1'
  const { isAiConfigured } = await import('../../lib/ai/openrouter')
  assert.equal(isAiConfigured(), true)
  delete process.env.OMNIROUTER_API_KEY
  delete process.env.OMNIROUTER_BASE_URL
})
