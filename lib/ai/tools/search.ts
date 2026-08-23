export async function searchPublicPosts(
  query: string,
  supabase: any,
  limit = 5,
) {
  const cleanQuery = query.trim().slice(0, 100)
  if (!cleanQuery) return { results: [] }

  const safeLimit = Math.min(Math.max(1, limit), 10)
  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, content, created_at, likes_count, author:profiles!posts_user_id_fkey(username, display_name)')
    .ilike('content', `%${cleanQuery}%`)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error || !posts) return { results: [] }

  return {
    query: cleanQuery,
    results: posts.map((p: any) => ({
      id: p.id,
      content: p.content,
      createdAt: p.created_at,
      likes: p.likes_count ?? 0,
      author: p.author?.display_name || p.author?.username || 'Vartotojas',
    })),
  }
}

export async function searchPublicServices(
  query: string,
  supabase: any,
  limit = 5,
) {
  const cleanQuery = query.trim().slice(0, 100)
  if (!cleanQuery) return { results: [] }

  const safeLimit = Math.min(Math.max(1, limit), 10)
  const { data: services, error } = await supabase
    .from('pro_services')
    .select('id, name, description, price, price_type, pro:profiles!pro_services_pro_id_fkey(username, display_name, location)')
    .eq('is_active', true)
    .ilike('name', `%${cleanQuery}%`)
    .limit(safeLimit)

  if (error || !services) return { results: [] }

  return {
    query: cleanQuery,
    results: services.map((s: any) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      priceType: s.price_type,
      provider: s.pro?.display_name || s.pro?.username || 'Meistras',
      location: s.pro?.location,
    })),
  }
}
