import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@/lib/backend-server';
import { rateLimit } from '@/lib/rate-limit';
import { handleApiError, badRequest, createErrorResponse } from '@/lib/api-error';

export const runtime = 'nodejs';

// Initialize Gemini SDK. Expects GEMINI_API_KEY in .env.local
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// In-process fallback rate limiter: 10 requests per 1 minute per user/IP.
const limiter = rateLimit({
  limit: 10,
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

const MAX_DESCRIPTION_LENGTH = 2000;

function sanitizeDescription(description: string): string {
  return description.replace(/[\r\n\t]+/g, ' ').trim().slice(0, MAX_DESCRIPTION_LENGTH);
}

export async function POST(req: Request) {
  try {
    // Authenticate user via Supabase
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Autorizacija privaloma' }, { status: 401 });
    }

    // Identify requester by User ID or fallback to IP address
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               req.headers.get('x-real-ip') ||
               'anonymous';
    const rateLimitKey = `estimate:${user.id}:${ip}`;

    const limitResult = await limiter.check(rateLimitKey);
    if (!limitResult.success) {
      return createErrorResponse('RATE_LIMITED', 429, 'Too many requests. Please try again later.', limitResult.resetIn);
    }

    const body = await req.json();
    const { description } = body;

    if (!description || typeof description !== 'string') {
      throw badRequest('Aprašymas privalomas');
    }

    const sanitizedDescription = sanitizeDescription(description);
    if (sanitizedDescription.length < 3) {
      throw badRequest('Aprašymas per trumpas');
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `${SYSTEM_PROMPT}\n\nKliento užklausa: ${sanitizedDescription}`;

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
      return NextResponse.json({ error: 'INTERNAL_ERROR', message: 'Nepavyko apdoroti AI atsakymo' }, { status: 500 });
    }

  } catch (error) {
    return handleApiError(error, { context: 'POST /api/estimate' });
  }
}
