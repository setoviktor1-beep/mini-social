import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'
export const maxDuration = 60

// This endpoint is called by Vercel Cron every hour
// Authorization via CRON_SECRET header
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
  const now = new Date()
  const results: string[] = []

  // Get all enabled enterprise agents
  const { data: configs } = await supabase
    .from('agent_config')
    .select('*')
    .eq('is_enabled', true)

  if (!configs || configs.length === 0) {
    return NextResponse.json({ processed: 0 })
  }

  for (const config of configs) {
    try {
      // Check subscription is enterprise + active
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan, status')
        .eq('user_id', config.user_id)
        .single()

      if (sub?.plan !== 'enterprise' || (sub.status !== 'active' && sub.status !== 'trialing')) {
        continue
      }

      const processed = await processAgent(supabase, genAI, config, now)
      if (processed) results.push(config.user_id)
    } catch (err) {
      console.error(`Agent error for user ${config.user_id}:`, err)
    }
  }

  return NextResponse.json({ processed: results.length, users: results })
}

async function processAgent(
  supabase: any,
  genAI: GoogleGenerativeAI,
  config: any,
  now: Date
): Promise<boolean> {
  const sent: string[] = []

  // 1. Check scheduled report
  const shouldSendReport = checkReportDue(config, now)
  if (shouldSendReport) {
    const report = await generateReport(supabase, genAI, config, now)
    if (report) {
      await sendAgentMessage(supabase, config.user_id, report, 'report')
      await supabase
        .from('agent_config')
        .update({ last_report_at: now.toISOString() })
        .eq('user_id', config.user_id)
      sent.push('report')
    }
  }

  // 2. Check triggers
  const triggers: any[] = config.triggers || []
  for (const trigger of triggers) {
    if (!trigger.enabled) continue
    const triggered = await checkTrigger(supabase, genAI, config, trigger, now)
    if (triggered) sent.push(trigger.type)
  }

  return sent.length > 0
}

function checkReportDue(config: any, now: Date): boolean {
  if (config.report_frequency === 'never') return false
  if (now.getHours() !== config.report_hour) return false

  const last = config.last_report_at ? new Date(config.last_report_at) : null

  if (config.report_frequency === 'daily') {
    if (!last) return true
    return now.getDate() !== last.getDate() || now.getMonth() !== last.getMonth()
  }

  if (config.report_frequency === 'weekly') {
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay()
    if (dayOfWeek !== config.report_day) return false
    if (!last) return true
    const diff = now.getTime() - last.getTime()
    return diff > 6 * 24 * 60 * 60 * 1000
  }

  if (config.report_frequency === 'monthly') {
    if (now.getDate() !== config.report_day) return false
    if (!last) return true
    return now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()
  }

  return false
}

async function generateReport(
  supabase: any,
  genAI: GoogleGenerativeAI,
  config: any,
  now: Date
): Promise<string | null> {
  const businessData = await fetchBusinessData(supabase, config.user_id, now)
  const memory = await fetchMemory(supabase, config.user_id)

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const period = config.report_frequency === 'daily' ? 'dienos' : config.report_frequency === 'weekly' ? 'savaitės' : 'mėnesio'

  const prompt = `Tu esi verslo AI agentas "${config.agent_name}". Tavo tonas: ${config.personality}.
Parašyk glaustą ${period} verslo ataskaitą vartotojui. Lietuviškai. Maksimaliai 300 žodžių.
Naudok emoji kur tinka. Pateik konkrečius skaičius ir veiksmų rekomendacijas.

${businessData}
${memory ? `\nVartotojo kontekstas:\n${memory}` : ''}`

  const result = await model.generateContent(prompt)
  return result.response.text()
}

async function checkTrigger(
  supabase: any,
  genAI: GoogleGenerativeAI,
  config: any,
  trigger: any,
  now: Date
): Promise<boolean> {
  // Check if this trigger fired recently (cooldown: 24h)
  const cooldownHours = 24
  const { data: recentFire } = await supabase
    .from('agent_trigger_log')
    .select('fired_at')
    .eq('user_id', config.user_id)
    .eq('trigger_type', trigger.type)
    .gte('fired_at', new Date(now.getTime() - cooldownHours * 60 * 60 * 1000).toISOString())
    .limit(1)
    .single()

  if (recentFire) return false

  let triggered = false
  let message = ''

  if (trigger.type === 'no_orders') {
    const days = trigger.days || 3
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
    const { count } = await supabase
      .from('service_requests')
      .select('*', { count: 'exact', head: true })
      .eq('pro_id', config.user_id)
      .gte('created_at', since)
    if ((count || 0) === 0) {
      triggered = true
      message = `⚠️ **Perspėjimas:** Per paskutines ${days} dienas negautas nė vienas užsakymas. Rekomenduoju patikrinti paslaugų katalogą ir apsvarstyti aktyvesnę komunikaciją su klientais.`
    }
  }

  if (trigger.type === 'new_client') {
    const since = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
    const { data: newOrders } = await supabase
      .from('service_requests')
      .select('client_id')
      .eq('pro_id', config.user_id)
      .gte('created_at', since)
      .limit(5)

    if (newOrders && newOrders.length > 0) {
      triggered = true
      message = `🎉 **Naujas užsakymas!** Gavote ${newOrders.length} naują užsakymą(-ų) per paskutinę valandą. Rekomenduoju greitai atsakyti — greitis didina klientų pasitenkinimą.`
    }
  }

  if (trigger.type === 'orders_drop') {
    const threshold = trigger.threshold || 5
    const period = trigger.period || 'week'
    const periodMs = period === 'week' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000
    const since = new Date(now.getTime() - periodMs).toISOString()
    const prevSince = new Date(now.getTime() - 2 * periodMs).toISOString()

    const [{ count: current }, { count: previous }] = await Promise.all([
      supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('pro_id', config.user_id).gte('created_at', since),
      supabase.from('service_requests').select('*', { count: 'exact', head: true }).eq('pro_id', config.user_id).gte('created_at', prevSince).lt('created_at', since),
    ])

    if ((previous || 0) > 0) {
      const dropPct = ((previous! - (current || 0)) / previous!) * 100
      if (dropPct >= threshold) {
        triggered = true
        message = `📉 **Užsakymų kritimas:** Užsakymų skaičius krito ${dropPct.toFixed(0)}% lyginant su praėjusiu laikotarpiu (${previous} → ${current}). Rekomenduoju peržiūrėti kainodarą ir klientų atsiliepimus.`
      }
    }
  }

  if (triggered && message) {
    await sendAgentMessage(supabase, config.user_id, message, 'trigger')
    await supabase
      .from('agent_trigger_log')
      .insert({ user_id: config.user_id, trigger_type: trigger.type })
    return true
  }

  return false
}

async function sendAgentMessage(
  supabase: any,
  userId: string,
  content: string,
  messageType: string
) {
  await supabase
    .from('agent_messages')
    .insert({ user_id: userId, content, message_type: messageType })

  // Also create a notification
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'agent_message',
      message: messageType === 'report' ? 'AI Agentas išsiuntė naują ataskaitą' : 'AI Agentas aptiko svarbų įvykį',
      is_read: false,
    })
}

async function fetchBusinessData(
  supabase: any,
  userId: string,
  now: Date
): Promise<string> {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [{ data: orders }, { data: services }] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, status, created_at, price')
      .eq('pro_id', userId)
      .gte('created_at', lastMonthStart)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('pro_services')
      .select('name, price, price_type, is_active')
      .eq('pro_id', userId),
  ])

  const thisMonth = (orders || []).filter((o: any) => o.created_at >= monthStart)
  const lastMonth = (orders || []).filter((o: any) => o.created_at < monthStart)
  const revenue = thisMonth.reduce((s: number, o: any) => s + (o.price || 0), 0)
  const lastRevenue = lastMonth.reduce((s: number, o: any) => s + (o.price || 0), 0)
  const statusCounts = (orders || []).reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1; return acc
  }, {})

  return `
VERSLO DUOMENYS:
- Šio mėnesio užsakymai: ${thisMonth.length}
- Šio mėnesio pajamos: €${revenue.toFixed(2)}
- Praėjusio mėnesio pajamos: €${lastRevenue.toFixed(2)}
- Pokytis: ${lastRevenue > 0 ? ((revenue - lastRevenue) / lastRevenue * 100).toFixed(0) + '%' : 'n/a'}
- Būsenos: ${Object.entries(statusCounts).map(([s, c]) => `${s}:${c}`).join(', ')}
- Aktyvios paslaugos: ${(services || []).filter((s: any) => s.is_active).map((s: any) => s.name).join(', ')}
`.trim()
}

async function fetchMemory(
  supabase: any,
  userId: string
): Promise<string> {
  const { data } = await supabase
    .from('ai_memory')
    .select('memory')
    .eq('user_id', userId)
    .single()
  if (!data?.memory) return ''
  return Object.entries(data.memory as Record<string, string>)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}
