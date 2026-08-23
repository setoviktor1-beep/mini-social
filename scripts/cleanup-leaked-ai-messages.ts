import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { validateAndSanitizeAiOutput } from '../lib/ai/security/output-guard'

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf-8')
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx > 0) {
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (!process.env[key]) {
        process.env[key] = val
      }
    }
  }
}

async function runCleanup() {
  loadEnvFile(path.resolve(process.cwd(), '.env.production'))
  loadEnvFile(path.resolve(process.cwd(), '.env.local'))

  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${process.env.POSTGRES_USER || 'mini_social'}:${process.env.POSTGRES_PASSWORD || ''}@127.0.0.1:5432/${process.env.POSTGRES_DB || 'mini_social'}`

  const pool = new Pool({ connectionString })
  const client = await pool.connect()

  try {
    console.log('[AI Leak Cleanup] Scanning ai_messages for leaked assistant traces...')

    const query = `
      SELECT id, role, content, user_id, conversation_id
      FROM ai_messages
      WHERE role = 'assistant'
        AND (
          content ILIKE '%thinking process%'
          OR content ILIKE '%[USER DATA START]%'
          OR content ILIKE '%available tools%'
          OR content ILIKE '%tool_call%'
          OR content ILIKE '%<think>%'
        )
    `
    const res = await client.query(query)

    console.log(`[AI Leak Cleanup] Found ${res.rows.length} affected assistant message(s).`)

    let sanitizedCount = 0
    let deletedCount = 0

    for (const row of res.rows) {
      const sanitized = validateAndSanitizeAiOutput({
        text: row.content,
        userId: row.user_id,
      })

      if (sanitized.safe && sanitized.sanitizedText.length >= 5) {
        await client.query('UPDATE ai_messages SET content = $1 WHERE id = $2', [
          sanitized.sanitizedText,
          row.id,
        ])
        sanitizedCount++
        console.log(`  [Sanitized] ID: ${row.id} -> Clean content length: ${sanitized.sanitizedText.length}`)
      } else {
        await client.query('DELETE FROM ai_messages WHERE id = $1', [row.id])
        deletedCount++
        console.log(`  [Deleted] ID: ${row.id} (Row contained only unrecoverable thinking/tool leaks)`)
      }
    }

    console.log(`\n[AI Leak Cleanup Completed]`)
    console.log(`  - Rows sanitized: ${sanitizedCount}`)
    console.log(`  - Rows deleted: ${deletedCount}`)
    console.log(`  - Total cleaned: ${sanitizedCount + deletedCount}`)
  } finally {
    client.release()
    await pool.end()
  }
}

runCleanup().catch(err => {
  console.error('[AI Leak Cleanup Error]:', err)
  process.exit(1)
})
