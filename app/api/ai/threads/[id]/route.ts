import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/backend-server'
import { handleApiError } from '@/lib/api-error'
import { isValidUuid } from '@/lib/ai/security/isolation'

export const runtime = 'nodejs'

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Pokalbis nerastas' }, { status: 404 })
    }

    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    // Verify ownership with defense in depth
    const { data: thread, error: threadError } = await supabase
      .from('ai_conversations')
      .select('id, title, user_id, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (threadError || !thread || thread.user_id !== user.id) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Pokalbis nerastas' }, { status: 404 })
    }

    // Fetch messages
    const { data: messages, error: messagesError } = await supabase
      .from('ai_messages')
      .select('id, role, content, model, provider, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      return NextResponse.json({ error: 'DB_ERROR', message: messagesError.message }, { status: 500 })
    }

    return NextResponse.json({
      thread: {
        id: thread.id,
        title: thread.title,
        created_at: thread.created_at,
        updated_at: thread.updated_at,
      },
      messages: messages || [],
    })
  } catch (error) {
    return handleApiError(error, { context: 'GET /api/ai/threads/[id]' })
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Pokalbis nerastas' }, { status: 404 })
    }

    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const body = await request.json().catch(() => null)
    const title = typeof body?.title === 'string' ? body.title.trim().slice(0, 80) : null
    if (!title) {
      return NextResponse.json({ error: 'INVALID_REQUEST', message: 'Pavadinimas privalomas' }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from('ai_conversations')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id, title, updated_at')
      .maybeSingle()

    if (error || !updated) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Pokalbis nerastas' }, { status: 404 })
    }

    return NextResponse.json({ thread: updated })
  } catch (error) {
    return handleApiError(error, { context: 'PATCH /api/ai/threads/[id]' })
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await props.params
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Pokalbis nerastas' }, { status: 404 })
    }

    const supabase = createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }

    const { data: deleted, error } = await supabase
      .from('ai_conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()

    if (error || !deleted) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Pokalbis nerastas' }, { status: 404 })
    }

    return NextResponse.json({ success: true, deletedId: deleted.id })
  } catch (error) {
    return handleApiError(error, { context: 'DELETE /api/ai/threads/[id]' })
  }
}
