export function parsePricePer1K(): number {
  const raw = process.env.PRICE_GEMINI_PER_1K
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('PRICE_GEMINI_PER_1K is missing or invalid')
  }
  return n
}

export function calcCostEUR(tokensIn: number, tokensOut: number, pricePer1K: number): number {
  const total = Math.max(0, tokensIn) + Math.max(0, tokensOut)
  const cost = (total / 1000) * pricePer1K
  return Number(cost.toFixed(4))
}

