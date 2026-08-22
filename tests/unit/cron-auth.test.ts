import { test } from 'node:test'
import assert from 'node:assert/strict'

function verifyCronAuth(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return false
  }
  return true
}

test('verifyCronAuth rejects requests when CRON_SECRET is undefined', () => {
  assert.equal(verifyCronAuth('Bearer undefined', undefined), false)
  assert.equal(verifyCronAuth('Bearer test', undefined), false)
  assert.equal(verifyCronAuth(null, undefined), false)
})

test('verifyCronAuth rejects requests when CRON_SECRET is empty string', () => {
  assert.equal(verifyCronAuth('Bearer ', ''), false)
  assert.equal(verifyCronAuth('Bearer secret', ''), false)
})

test('verifyCronAuth rejects invalid token', () => {
  assert.equal(verifyCronAuth('Bearer wrong-secret', 'correct-secret'), false)
  assert.equal(verifyCronAuth(null, 'correct-secret'), false)
})

test('verifyCronAuth accepts exact Bearer match', () => {
  assert.equal(verifyCronAuth('Bearer correct-secret', 'correct-secret'), true)
})
