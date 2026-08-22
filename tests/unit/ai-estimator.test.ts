import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parsePriceEstimateJson } from '../../lib/ai-estimator'

test('parsePriceEstimateJson parses clean JSON', () => {
  const input = '{"min": 35, "max": 75}'
  const result = parsePriceEstimateJson(input)
  assert.deepEqual(result, { min: 35, max: 75 })
})

test('parsePriceEstimateJson parses JSON wrapped in markdown code blocks', () => {
  const input = '```json\n{"min": 50, "max": 120}\n```'
  const result = parsePriceEstimateJson(input)
  assert.deepEqual(result, { min: 50, max: 120 })
})

test('parsePriceEstimateJson handles extra conversational text before and after JSON', () => {
  const input = 'Štai preliminari sąmata:\n{"min": 40, "max": 90}\nTikimės padėti!'
  const result = parsePriceEstimateJson(input)
  assert.deepEqual(result, { min: 40, max: 90 })
})

test('parsePriceEstimateJson handles non-integer, negative, or invalid values safely', () => {
  const input = '{"min": -10, "max": 65.8}'
  const result = parsePriceEstimateJson(input)
  assert.equal(result.min, 20) // fallback for negative
  assert.equal(result.max, 66) // rounded finite number
})

test('parsePriceEstimateJson throws when no JSON object is present', () => {
  assert.throws(() => parsePriceEstimateJson('Atsiprašau, negaliu nustatyti kainos.'))
})
