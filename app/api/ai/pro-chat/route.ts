import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const runtime = 'nodejs'

const AI_LIMITS: Record<string, number> = {
  pro:        100,
  enterprise: 500,
}

// Cache business data per user for 5 minutes
const businessDataCache = new Map<string, { data: string; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000

async function getBusinessContext(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<string> {
  const cached = businessDataCache.get(userId)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    { data: orders },
    { data: services },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, status, created_at, price, client:profiles!service_requests_client_id_fkey(display_name, username)')
      .eq('pro_id', userId)
      .gte('created_at', lastMonthStart)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('pro_services')
      .select('name, price, price_type, is_active')
      .eq('pro_id', userId),
    supabase
      .from('profiles')
      .select('display_name, username, pro_radius_km, working_hours')
      .eq('id', userId)
      .single(),
  ])

  // Calculate stats
  const thisMonthOrders = (orders || []).filter(o => o.created_at >= monthStart)
  const lastMonthOrders = (orders || []).filter(o => o.created_at < monthStart)

  const revenue = (thisMonthOrders).reduce((s, o) => s + (o.price || 0), 0)
  const lastRevenue = lastMonthOrders.reduce((s, o) => s + (o.price || 0), 0)

  const statusCounts = (orders || []).reduce((acc: Record<string, number>, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  const uniqueClients = new Set((orders || []).map((o: any) => o.client?.username).filter(Boolean)).size

  const ctx = `
=== VERSLO DUOMENYS (${now.toLocaleDateString('lt-LT')}) ===

Verslas: ${profile?.display_name || profile?.username || 'Nežinomas'}

ŠIO MĖNESIO STATISTIKA:
- Užsakymų: ${thisMonthOrders.length}
- Pajamos: €${revenue.toFixed(2)}
- Palyginimas su praėjusiu mėnesiu: ${lastRevenue > 0 ? (revenue >= lastRevenue ? '+' : '') + ((revenue - lastRevenue) / lastRevenue * 100).toFixed(0) + '%' : 'n/a'}

UŽSAKYMŲ BŪSENOS (paskutiniai 2 mėn.):
${Object.entries(statusCounts).map(([s, c]) => `- ${s}: ${c}`).join('\n') || '- Nėra'}

KLIENTAI:
- Unikalių klientų (2 mėn.): ${uniqueClients}
- Naujausias užsakymas: ${orders?.[0] ? new Date(orders[0].created_at).toLocaleDateString('lt-LT') : 'Nėra'}

PASLAUGŲ KATALOGAS:
${(services || []).map(s => `- ${s.name}: €${s.price} (${s.price_type})${s.is_active ? '' : ' [neaktyvus]'}`).join('\n') || '- Nėra paslaugų'}

NUSTATYMAI:
- Darbo spindulys: ${profile?.pro_radius_km || 'nenurodytas'} km
`.trim()

  businessDataCache.set(userId, { data: ctx, ts: Date.now() })
  return ctx
}

async function getMemory(supabase: ReturnType<typeof createSupabaseServerClient>, userId: string): Promise<string> {
  const { data } = await supabase
    .from('ai_memory')
    .select('memory')
    .eq('user_id', userId)
    .single()

  if (!data?.memory || Object.keys(data.memory).length === 0) return ''

  const m = data.memory as Record<string, string>
  return `
=== ATMINTIS (iš ankstesnių pokalbių) ===
${Object.entries(m).map(([k, v]) => `- ${k}: ${v}`).join('\n')}
`.trim()
}

async function updateMemory(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  messages: { role: string; text: string }[],
  reply: string,
  genAI: GoogleGenerativeAI
) {
  try {
    const { data: existing } = await supabase
      .from('ai_memory')
      .select('memory')
      .eq('user_id', userId)
      .single()

    const currentMemory = existing?.memory || {}

    const extractModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const conversation = messages.map(m => `${m.role === 'user' ? 'Vartotojas' : 'AI'}: ${m.text}`).join('\n') + `\nAI: ${reply}`

    const prompt = `Išanalizuok šį pokalbį ir ištrauk svarbius faktus apie vartotojo verslą, pageidavimus ar problemas, kuriuos verta prisiminti ateičiai. Grąžink TIKTAI JSON objektą, be jokio kito teksto. Maks 8 raktai, trumpos reikšmės lietuviškai.

Esama atmintis: ${JSON.stringify(currentMemory)}

Pokalbis:
${conversation}

JSON formatas: {"faktas1": "reikšmė", "faktas2": "reikšmė"}`

    const result = await extractModel.generateContent(prompt)
    const text = result.response.text().replace(/```json|```/g, '').trim()
    const newFacts = JSON.parse(text)

    await supabase
      .from('ai_memory')
      .upsert({ user_id: userId, memory: { ...currentMemory, ...newFacts }, updated_at: new Date().toISOString() })
  } catch {
    // Memory update failure is non-critical
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Check subscription
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const plan = sub?.plan
    const isActive = sub?.status === 'active' || sub?.status === 'trialing'

    if (!isActive || !plan || !AI_LIMITS[plan]) {
      return NextResponse.json({
        error: 'SUBSCRIPTION_REQUIRED',
        message: 'AI chat prieinamas tik Pro ir Enterprise planams.',
      }, { status: 403 })
    }

    const limit = AI_LIMITS[plan]

    const { data: allowed } = await supabase.rpc('check_and_increment_ai_usage', {
      p_user_id: user.id,
      p_limit: limit,
    })

    if (!allowed) {
      return NextResponse.json({
        error: 'LIMIT_REACHED',
        message: `Pasiektas mėnesio limitas (${limit} žinutės). Limitas atsinaujins kitą mėnesį.`,
      }, { status: 429 })
    }

    const { message, history } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: 'EMPTY_MESSAGE' }, { status: 400 })
    }

    // Fetch memory + business data in parallel (business data is cached)
    const [memoryCtx, businessCtx] = await Promise.all([
      getMemory(supabase, user.id),
      getBusinessContext(supabase, user.id),
    ])

    const systemPrompt = `Tu esi verslo AI asistentas MiniSocial platformoje.
Padedi verslininkams su klientų komunikacija, kainų skaičiavimu, verslo patarimais, užsakymų valdymu ir statistikos analize.
Atsakyk lietuviškai, glaustai ir profesionaliai.
Jei klausiama apie statistiką ar verslo duomenis — naudok žemiau pateiktus realius duomenis.

${businessCtx}

${memoryCtx}`

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
    })

    const chat = model.startChat({
      history: (history || []).map((m: { role: string; text: string }) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.text }],
      })),
    })

    const result = await chat.sendMessage(message)
    const reply = result.response.text()

    // Update memory in background (don't await)
    updateMemory(supabase, user.id, [...(history || []), { role: 'user', text: message }], reply, genAI)

    // Invalidate business data cache so next fetch is fresh
    businessDataCache.delete(user.id)

    const currentMonth = new Date().toISOString().slice(0, 7)
    const { data: usage } = await supabase
      .from('ai_usage')
      .select('count')
      .eq('user_id', user.id)
      .eq('month', currentMonth)
      .single()

    return NextResponse.json({
      reply,
      usage: { used: usage?.count || 0, limit },
    })
  } catch (error) {
    console.error('Pro chat error:', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
