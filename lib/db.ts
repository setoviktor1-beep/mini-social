import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

declare global {
  // Reuse the pool during local hot reloads.
  var __miniSocialPgPool: Pool | undefined
}

function createPool() {
  const connectionString =
    process.env.DATABASE_URL ||
    (process.env.NEXT_PHASE === 'phase-production-build'
      ? 'postgresql://build:build@127.0.0.1:5432/build'
      : undefined)

  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_MAX || 15),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: 'mini-social',
  })
}

export function getPool() {
  if (!globalThis.__miniSocialPgPool) {
    globalThis.__miniSocialPgPool = createPool()
  }

  return globalThis.__miniSocialPgPool
}

export function getDb() {
  return drizzle(getPool())
}
