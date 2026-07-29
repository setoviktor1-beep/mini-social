import { NextResponse } from 'next/server';
import { createClient } from '@/lib/backend-server';
import { createSupabaseServiceClient } from '@/lib/backend-server';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError, createErrorResponse } from '@/lib/api-error';

export const runtime = 'nodejs';

const servicesLimiter = rateLimit({
  limit: 30,
  windowMs: 60 * 1000,
});

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
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'anonymous';
    const rateLimitKey = `services:${user.id}:${ip}`;
    const limitResult = await servicesLimiter.check(rateLimitKey);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfter: limitResult.resetIn },
        {
          status: 429,
          headers: { 'Retry-After': String(limitResult.resetIn) },
        }
      );
    }

    const { searchParams } = new URL(req.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');
    const category = searchParams.get('category') || 'restaurant';
    const radius = Math.min(parseInt(searchParams.get('radius') || '5000'), 5000);

    const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!lat || !lng) {
      return NextResponse.json({ error: 'LOCATION_REQUIRED' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'MAPS_API_KEY_MISSING' }, { status: 500 });
    }

    const serviceClient = createSupabaseServiceClient();

    const cacheKey = makeCacheKey(lat, lng, category, radius);

    // 1. Check cache
    const { data: cached } = await serviceClient
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

    // 3. Store in cache (upsert) - use service role for unconditional cache writes
    await serviceClient.from('maps_cache').upsert({
      cache_key: cacheKey,
      data: results,
      cached_at: new Date().toISOString(),
    });

    return NextResponse.json(results, {
      headers: { 'X-Cache': 'MISS' },
    });
  } catch (error) {
    return handleApiError(error, { context: 'GET /api/services' });
  }
}
