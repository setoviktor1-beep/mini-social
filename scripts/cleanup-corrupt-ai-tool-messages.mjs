#!/usr/bin/env node

/**
 * Script: cleanup-corrupt-ai-tool-messages.mjs
 * Purpose: Safely scans and cleans up corrupted AI messages containing leaked tool syntax (```tool_call, <tool_call>, etc.)
 *
 * Usage:
 *   node scripts/cleanup-corrupt-ai-tool-messages.mjs          (Dry-run mode, default)
 *   node scripts/cleanup-corrupt-ai-tool-messages.mjs --apply  (Destructive cleanup mode)
 */

import fs from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const { Pool } = pg

function loadEnv() {
  const candidates = ['.env.production', '.env.local', '.env']
  for (const file of candidates) {
    const fullPath = path.resolve(process.cwd(), file)
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim()
            let val = trimmed.slice(eqIdx + 1).trim()
            if (
              (val.startsWith('"') && val.endsWith('"')) ||
              (val.startsWith("'") && val.endsWith("'"))
            ) {
              val = val.slice(1, -1)
            }
            if (!process.env[key]) {
              process.env[key] = val
            }
          }
        }
      }
    }
  }
}

loadEnv()

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL is not defined in environment or .env files.')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 })

const CORRUPT_PATTERNS = [
  '```tool_call',
  '```tool_code',
  '```function_call',
  '<tool_call>',
  '```json\n{"tool"',
  '```json\n{"tool":',
]

function isCorruptContent(content) {
  if (typeof content !== 'string') return false
  const lower = content.toLowerCase()
  for (const pattern of CORRUPT_PATTERNS) {
    if (lower.includes(pattern.toLowerCase())) return true
  }
  if (
    /`{3,}(?:tool_call|tool_code|function_call)[\s\S]*?`{3,}/i.test(content) ||
    /<tool_call>[\s\S]*?<\/tool_call>/i.test(content)
  ) {
    return true
  }
  return false
}

async function main() {
  const isApplyMode = process.argv.includes('--apply')

  console.log('='.repeat(60))
  console.log(' MiniSocial AI Corrupt Tool Messages Cleanup')
  console.log(` Mode: ${isApplyMode ? 'APPLY (DESTRUCTIVE CLEANUP)' : 'DRY-RUN (NO CHANGES MADE)'}`)
  console.log('='.repeat(60))

  try {
    const { rows: messages } = await pool.query(
      "SELECT id, conversation_id, user_id, role, content, created_at FROM public.ai_messages WHERE role = 'assistant' ORDER BY created_at DESC",
    )

    console.log(`Scanned ${messages.length} assistant messages in total.`)

    const corruptMessages = messages.filter((m) => isCorruptContent(m.content))

    console.log(`Found ${corruptMessages.length} corrupted messages.\n`)

    if (corruptMessages.length === 0) {
      console.log('No corrupted messages found. Database is clean!')
      return
    }

    for (const msg of corruptMessages) {
      console.log(`[ID: ${msg.id}] Date: ${msg.created_at}`)
      console.log(`Preview: ${msg.content.slice(0, 120).replace(/\n/g, ' ')}...`)
      console.log('-'.repeat(40))
    }

    if (!isApplyMode) {
      console.log('\nDRY-RUN completed. To delete these messages, run:')
      console.log('  node scripts/cleanup-corrupt-ai-tool-messages.mjs --apply')
      return
    }

    const idsToDelete = corruptMessages.map((m) => m.id)
    console.log(`\nDeleting ${idsToDelete.length} corrupted messages...`)

    const { rowCount } = await pool.query(
      'DELETE FROM public.ai_messages WHERE id = ANY($1::uuid[])',
      [idsToDelete],
    )

    console.log(`Successfully deleted ${rowCount} corrupted messages!`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
