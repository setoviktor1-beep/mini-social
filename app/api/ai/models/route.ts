import { NextResponse } from 'next/server'
import { AVAILABLE_AI_MODELS, DEFAULT_AI_MODEL_ID } from '@/lib/ai/constants'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({
    models: AVAILABLE_AI_MODELS,
    defaultModel: DEFAULT_AI_MODEL_ID,
  })
}
