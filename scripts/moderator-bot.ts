// scripts/moderator-bot.ts
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://sqgnooxihstgmktuzeqg.supabase.co'
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY! // Naudokite tik serveryje!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE)

async function autoModerate() {
  console.log('🤖 Starting auto-moderation job...')

  // 1. Fetch open reports
  const { data: reports, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'open')

  if (error) {
    console.error('Error fetching reports:', error)
    return
  }

  for (const report of reports) {
    // Pavyzdys: jei pranešimo priežastis yra "spam", automatiškai paslepiame
    if (report.reason.toLowerCase().includes('spam')) {
      console.log(`Auto-hiding ${report.target_type} due to spam report: ${report.target_id}`)
      
      const table = report.target_type === 'post' ? 'posts' : 'comments'
      
      await supabase.from(table).update({ status: 'hidden' }).eq('id', report.target_id)
      await supabase.from('reports').update({ status: 'reviewed' }).eq('id', report.id)
      
      // Log action
      await supabase.from('moderation_actions').insert({
        action_type: 'auto_hide_spam',
        target_type: report.target_type,
        target_id: report.target_id,
        notes: 'Automatically hidden by VPS Moderator Bot'
      })
    }
  }

  console.log('✅ Job finished.')
}

// Run every 10 minutes (logic for cron)
autoModerate()
