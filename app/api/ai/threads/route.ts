import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/backend-server'
import { handleApiError } from '@/lib/api-error'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: threads, error } = await supabase
      .from('ai_conversations')
      .select('id, title, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: 'DB_ERROR', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ threads: threads || [] })
  } catch (error) {
    return handleApiError(error, { context: 'GET /api/ai/threads' })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const title =
      typeof body?.title === 'string' && body.title.trim()
        ? body.title.trim().slice(0, 80)
        : 'Naujas pokalbis'

    const { data: thread, error } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: user.id,
        title,
      })
      .select('id, title, created_at, updated_at')
      .single()

    if (error) {
      return NextResponse.json({ error: 'CREATE_FAILED', message: error.message }, { status: 500 })
    }

    return NextResponse.json({ thread }, { status: 201 })
  } catch (error) {
    return handleApiError(error, { context: 'POST /api/ai/threads' })
  }
}
