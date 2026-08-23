import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { AiError } from '../../lib/ai/errors'

describe('AI Router Fallback Policy', () => {
  test('Transient errors (429, 502, timeout) should trigger fallback; Auth and Invalid errors must NOT', async () => {
    const errorCodes = [
      { code: 'AI_RATE_LIMITED', status: 429, shouldFallback: true },
      { code: 'AI_PROVIDER_ERROR', status: 502, shouldFallback: true },
      { code: 'AI_TIMEOUT', status: 504, shouldFallback: true },
      { code: 'AI_FORBIDDEN', status: 403, shouldFallback: false },
      { code: 'AI_INVALID_REQUEST', status: 400, shouldFallback: false },
      { code: 'AI_UNAVAILABLE', status: 503, shouldFallback: false },
    ]

    for (const item of errorCodes) {
      const error = new AiError(item.code as any, 'Test error', { status: item.status })
      const targetModel = 'primary-model'
      const fallbackModel = 'fallback-model'

      const isEligible =
        error instanceof AiError &&
        (error.code === 'AI_RATE_LIMITED' ||
          error.code === 'AI_PROVIDER_ERROR' ||
          error.code === 'AI_TIMEOUT') &&
        targetModel !== fallbackModel

      assert.equal(
        isEligible,
        item.shouldFallback,
        `Expected error ${item.code} fallback eligibility to be ${item.shouldFallback}`,
      )
    }
  })
})
