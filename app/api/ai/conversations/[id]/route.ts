import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ limit: 10, windowMs: 60_000 });

async function requireAuth(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, error: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }) };
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const { success } = limiter.check(user.id || ip);
  if (!success) {
    return {
      supabase,
      user: null,
      error: NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      ),
    };
  }

  return { supabase, user, error: null };
}

async function getOwnedConversation(supabase: ReturnType<typeof createSupabaseServerClient>, conversationId: string, userId: string) {
  return supabase
    .from("ai_conversations")
    .select("id, user_id, title, updated_at, created_at")
    .eq("id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireAuth(request);
  if (error || !user) return error!;

  const { data: conversation, error: convoError } = await getOwnedConversation(supabase, params.id, user.id);
  if (convoError) {
    return NextResponse.json({ error: "FAILED_TO_LOAD_CONVERSATION", details: convoError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { data: messages, error: msgError } = await supabase
    .from("ai_messages")
    .select("id, role, content, tokens_used, cost, created_at")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true });

  if (msgError) {
    return NextResponse.json({ error: "FAILED_TO_LOAD_MESSAGES", details: msgError.message }, { status: 500 });
  }

  return NextResponse.json({
    ...conversation,
    messages: messages || [],
  });
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const { supabase, user, error } = await requireAuth(request);
  if (error || !user) return error!;

  const { data: conversation, error: convoError } = await getOwnedConversation(supabase, params.id, user.id);
  if (convoError) {
    return NextResponse.json({ error: "FAILED_TO_LOAD_CONVERSATION", details: convoError.message }, { status: 500 });
  }
  if (!conversation) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("ai_conversations").delete().eq("id", params.id).eq("user_id", user.id);
  if (deleteError) {
    return NextResponse.json({ error: "FAILED_TO_DELETE_CONVERSATION", details: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
