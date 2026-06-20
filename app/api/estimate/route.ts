import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/server-supabase';
import { rateLimit } from '@/lib/rate-limit';

// Initialize Gemini SDK. Expects GEMINI_API_KEY in .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-process fallback rate limiter: 5 requests per 1 minute.
// Easily swap-able with Redis since it's defined in lib/rate-limit.ts.
const limiter = rateLimit({
  limit: 5,
  windowMs: 60 * 1000,
});

const SYSTEM_PROMPT = `
Tu esi profesionalus statybų ir buities remonto sąmatininkas.
Tavo užduotis yra išanalizuoti kliento problemą ir grąžinti atsakymą TIK JSON formatu.
Atsakyme negali būti jokio kito teksto, tik šis JSON:
{
  "category": "santechnika | elektra | apdaila | surinkimas | kita",
  "materials": ["medžiaga 1", "medžiaga 2"],
  "estimated_price_min": 50,
  "estimated_price_max": 150,
  "estimated_duration_hours": 2,
  "summary": "Trumpas paaiškinimas meistrui (1-2 sakiniai)"
}
Jei užklausa visiškai nesusijusi su buities darbais ar remontu, grąžink:
{ "error": "UNSUPPORTED_TOPIC" }
`;

export async function POST(req: Request) {
  try {
    // Authenticate user via Supabase
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Identify requester by User ID or fallback to IP address
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               req.headers.get('x-real-ip') ||
               'anonymous';
    const rateLimitKey = user ? `user:${user.id}` : `ip:${ip}`;

    const limitResult = await limiter.check(rateLimitKey);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(limitResult.resetIn),
          },
        }
      );
    }

    const body = await req.json();
    const { description } = body;

    if (!description) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `${SYSTEM_PROMPT}\n\nKliento užklausa: ${description}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up potential markdown formatting from the response
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
      const parsed = JSON.parse(text);
      return NextResponse.json(parsed);
    } catch (parseError) {
      console.error("Failed to parse Gemini output:", text);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

  } catch (error: any) {
    console.error("AI Estimate Error:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
