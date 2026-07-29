import { createClient } from '@/lib/backend-server';
import { NextResponse } from 'next/server';
import { getPriceEstimate } from '@/lib/ai-estimator';
import { handleApiError, unauthorized, badRequest, rateLimited } from '@/lib/api-error';
import { rateLimit } from '@/lib/rate-limit';

const orderLimiter = rateLimit({ limit: 10, windowMs: 60 * 1000 });

export async function POST(req: Request) {
  try {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw unauthorized();

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || req.headers.get('x-real-ip') || 'anonymous';
    const limit = await orderLimiter.check(`orders:${user.id}:${ip}`);
    if (!limit.success) throw rateLimited(limit.resetIn, 'Per daug užsakymų. Bandykite vėliau.');

    const { proId, description, photoUrl } = await req.json();

    if (!proId || typeof proId !== 'string') throw badRequest('Trūksta meistro ID');
    if (!description || typeof description !== 'string') throw badRequest('Trūksta aprašymo');

    // --- RATE LIMITING ---
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count, error: countError } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('client_id', user.id)
      .gt('created_at', oneHourAgo);

    if (countError) throw new Error(countError.message);
    if (count && count >= 3) {
      throw rateLimited(3600, 'Viršijote valandos užsakymų limitą (3/val)');
    }

    // --- AI ESTIMATION ---
    const estimate = await getPriceEstimate(description, user.id);

    // --- SAVE ORDER ---
    const { data: order, error } = await supabase
      .from('orders')
      .insert([{
        client_id: user.id,
        pro_id: proId,
        description,
        photo_url: photoUrl,
        ai_estimate_min: estimate.min,
        ai_estimate_max: estimate.max,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json(order);
  } catch (error) {
    return handleApiError(error, { context: 'POST /api/orders/create' });
  }
}
