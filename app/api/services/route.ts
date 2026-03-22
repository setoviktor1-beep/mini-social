import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Google Maps ToS 3.2.3: temporary caching allowed for performance.
// Places API specific terms: max 30 days. We use 24h to keep data fresh.
const CACHE_TTL_HOURS = 24;

// Round coordinates to 2 decimal places (~1.1km precision) so nearby users share cache
function roundCoord(n: number) {
  return Math.round(n * 100) / 100;
}

function makeCacheKey(lat: string, lng: string, category: string, radius: number) {
  return `${roundCoord(parseFloat(lat))},${roundCoord(parseFloat(lng))},${category},${radius}`;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const category = searchParams.get('category') || 'restaurant';
  const radius = Math.min(parseInt(searchParams.get('radius') || '5000'), 5000);

  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (!lat || !lng) {
    return NextResponse.json({ error: 'Lokacija nenustatyta' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Trūksta Google Maps API rakto' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const cacheKey = makeCacheKey(lat, lng, category, radius);

  // 1. Check cache
  const { data: cached } = await supabase
    .from('maps_cache')
    .select('data, cached_at')
    .eq('cache_key', cacheKey)
    .single();

  if (cached) {
    const ageHours = (Date.now() - new Date(cached.cached_at).getTime()) / 3_600_000;
    if (ageHours < CACHE_TTL_HOURS) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'HIT', 'X-Cache-Age': `${Math.round(ageHours)}h` },
      });
    }
  }

  // 2. Fetch from Google
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${category}&key=${apiKey}`
    );

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(data.error_message || 'Google API klaida');
    }

    const results = (data.results || []).map((place: any) => ({
      id: place.place_id,
      name: place.name,
      address: place.vicinity,
      rating: place.rating || 0,
      isOpen: place.opening_hours?.open_now ?? true,
      category,
      distance: 'Skaičiuojama...',
      icon: category === 'restaurant' ? 'Utensils' : 'Store',
    }));

    // 3. Store in cache (upsert)
    await supabase.from('maps_cache').upsert({
      cache_key: cacheKey,
      data: results,
      cached_at: new Date().toISOString(),
    });

    return NextResponse.json(results, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error: any) {
    // If Google fails but we have stale cache, return it anyway
    if (cached?.data) {
      return NextResponse.json(cached.data, {
        headers: { 'X-Cache': 'STALE' },
      });
    }
    console.error('Services API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
