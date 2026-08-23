export async function getMyBusinessStats(userId: string, supabase: any) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

  const [
    { data: orders },
    { data: services },
  ] = await Promise.all([
    supabase
      .from('service_requests')
      .select('id, status, created_at, price')
      .eq('pro_id', userId)
      .gte('created_at', lastMonthStart)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('pro_services')
      .select('name, price, price_type, is_active')
      .eq('pro_id', userId),
  ])

  const thisMonthOrders = (orders || []).filter((o: any) => o.created_at >= monthStart)
  const lastMonthOrders = (orders || []).filter((o: any) => o.created_at < monthStart)

  const thisMonthRevenue = thisMonthOrders.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0)
  const lastMonthRevenue = lastMonthOrders.reduce((sum: number, o: any) => sum + (Number(o.price) || 0), 0)

  const statusCounts = (orders || []).reduce((acc: Record<string, number>, o: any) => {
    acc[o.status] = (acc[o.status] || 0) + 1
    return acc
  }, {})

  return {
    thisMonthOrdersCount: thisMonthOrders.length,
    thisMonthRevenue,
    lastMonthRevenue,
    growthRatePct: lastMonthRevenue > 0
      ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : null,
    orderStatusSummary: statusCounts,
    activeServicesCount: (services || []).filter((s: any) => s.is_active).length,
  }
}

export async function getMyServices(userId: string, supabase: any) {
  const { data: services, error } = await supabase
    .from('pro_services')
    .select('id, name, description, price, price_type, is_active')
    .eq('pro_id', userId)

  if (error || !services) return { services: [] }

  return {
    services: services.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      priceType: s.price_type,
      isActive: s.is_active,
    })),
  }
}

export async function getMyOrders(userId: string, supabase: any, limit = 10) {
  const safeLimit = Math.min(Math.max(1, limit), 20)
  const { data: orders, error } = await supabase
    .from('service_requests')
    .select('id, status, price, created_at, scheduled_for, client_id, pro_id')
    .or(`pro_id.eq.${userId},client_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error || !orders) return { orders: [] }

  return {
    orders: orders.map((o: any) => ({
      id: o.id,
      status: o.status,
      price: o.price,
      createdAt: o.created_at,
      scheduledFor: o.scheduled_for,
      role: o.pro_id === userId ? 'provider' : 'client',
    })),
  }
}

/**
 * Prepares a proposed service draft for user confirmation.
 * Write actions NEVER automatically execute without explicit user approval.
 */
export async function prepareCreateService(
  userId: string,
  params: { name?: string; price?: number; priceType?: string; description?: string },
) {
  const cleanName = (params.name || '').trim().slice(0, 100)
  if (!cleanName) {
    return { error: 'Paslaugos pavadinimas yra privalomas' }
  }
  const numericPrice = typeof params.price === 'number' && params.price >= 0 ? params.price : 0
  const priceType = params.priceType === 'fixed' || params.priceType === 'hourly' || params.priceType === 'from'
    ? params.priceType
    : 'from'

  return {
    action: 'create_service',
    status: 'draft',
    requiresConfirmation: true,
    draft: {
      name: cleanName,
      price: numericPrice,
      price_type: priceType,
      description: (params.description || '').trim().slice(0, 500),
    },
    message: `Paruoštas pasiūlymas sukurti paslaugą: "${cleanName}" (${priceType === 'from' ? 'nuo ' : ''}€${numericPrice}). Reikalingas vartotojo patvirtinimas.`,
  }
}
