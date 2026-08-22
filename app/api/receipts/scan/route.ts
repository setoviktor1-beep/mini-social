import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/backend-server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeImageUpload } from '@/lib/image-security'

export const runtime = 'nodejs'

const scanLimiter = rateLimit({
  limit: 10,
  windowMs: 60 * 1000,
})

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get('content-length') || 0)
    if (contentLength > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'IMAGE_TOO_LARGE' }, { status: 413 })
    }

    const supabase = createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })

    const limitResult = await scanLimiter.check(`receipt-scan:${user.id}`)
    if (!limitResult.success) {
      return NextResponse.json(
        { error: 'RATE_LIMITED' },
        {
          status: 429,
          headers: { 'Retry-After': String(limitResult.resetIn) },
        }
      )
    }

    // Only Enterprise
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', user.id)
      .single()

    const isActive = sub?.status === 'active' || sub?.status === 'trialing'
    if (!isActive || sub?.plan !== 'enterprise') {
      return NextResponse.json({ error: 'ENTERPRISE_REQUIRED' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : null
    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : 'image/jpeg'
    if (!imageBase64) return NextResponse.json({ error: 'MISSING_IMAGE' }, { status: 400 })

    let sanitized
    try {
      const decoded = Buffer.from(imageBase64, 'base64')
      sanitized = await sanitizeImageUpload(decoded, mimeType)
    } catch {
      return NextResponse.json({ error: 'INVALID_IMAGE' }, { status: 400 })
    }

    const sanitizedBase64 = sanitized.body.toString('base64')

    // Upload to private object storage
    let imagePath: string | null = null
    try {
      const serviceClient = createSupabaseServiceClient()
      const filename = `${user.id}/${Date.now()}.${sanitized.extension}`
      const { data: uploadData } = await serviceClient.storage
        .from('receipts')
        .upload(filename, sanitized.body, {
          contentType: sanitized.contentType,
          upsert: false,
        })
      if (uploadData) {
        imagePath = uploadData.path
      }
    } catch {
      // Storage upload failure is non-critical — continue without image URL
    }

    // Analyze with Gemini Vision
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `Išanalizuok šį čekio/sąskaitos vaizdą ir ištrauk šią informaciją. Grąžink TIKTAI JSON, be jokio kito teksto:
{
  "vendor": "pardavėjo pavadinimas arba null",
  "amount": skaičius arba null,
  "date": "YYYY-MM-DD formatu arba null",
  "category": "vienas iš: maistas, transportas, ryšiai, įrankiai, reklama, apsauga, komunaliniai, kita",
  "raw_text": "trumpas čekio turinio aprašymas"
}`

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: sanitizedBase64,
          mimeType: sanitized.contentType,
        },
      },
    ])

    const text = result.response.text().replace(/```json|```/g, '').trim()
    let extracted: Record<string, any> = {}
    try {
      extracted = JSON.parse(text)
    } catch {
      extracted = { raw_text: text }
    }

    // Save to receipts table
    const { data: receipt, error } = await supabase
      .from('receipts')
      .insert({
        user_id: user.id,
        image_url: imagePath,
        vendor: extracted.vendor || null,
        amount: extracted.amount ? Number(extracted.amount) : null,
        category: extracted.category || 'kita',
        receipt_date: extracted.date || null,
        raw_text: extracted.raw_text || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })

    let receiptWithSignedUrl = receipt
    if (receipt.image_url) {
      const serviceClient = createSupabaseServiceClient()
      const { data: signed } = await serviceClient.storage
        .from('receipts')
        .createSignedUrl(receipt.image_url, 5 * 60)
      receiptWithSignedUrl = { ...receipt, image_url: signed?.signedUrl || null }
    }

    return NextResponse.json({ receipt: receiptWithSignedUrl, extracted })
  } catch (error) {
    console.error('Receipt scan error:', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
