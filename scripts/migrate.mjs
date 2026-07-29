import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Pool } = pg
const directory = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'db',
  'migrations',
)

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)

  const migrations = (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const name of migrations) {
    const applied = await pool.query(
      'SELECT 1 FROM public.schema_migrations WHERE name = $1',
      [name],
    )
    if (applied.rowCount) continue

    process.stdout.write(`Applying ${name}... `)
    const sql = await readFile(join(directory, name), 'utf8')
    await pool.query(sql)
    await pool.query(
      'INSERT INTO public.schema_migrations(name) VALUES ($1)',
      [name],
    )
    process.stdout.write('done\n')
  }
} finally {
  await pool.end()
}
