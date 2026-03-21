import { createClient } from '@/lib/server-supabase';
import { NextResponse } from 'next/server';
import { getPriceEstimate } from '@/lib/ai-estimator';

export async function POST(req: Request) {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Autorizuotis būtina' }, { status: 401 });

  const { proId, description, photoUrl } = await req.json();

  // --- RATE LIMITING ---
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { count, error: countError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', user.id)
    .gt('created_at', oneHourAgo);

  if (count && count >= 3) {
    return NextResponse.json({ error: 'Viršijote valandos užsakymų limitą (3/val)' }, { status: 429 });
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(order);
}
