import { NextResponse } from "next/server";
import {
  MAX_CONVERSATIONS_PER_USER,
} from "@/lib/ai/context-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const limiter = rateLimit({ limit: 10, windowMs: 60_000 });

async function getAuthUser(request: Request) {
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

export async function GET(request: Request) {
  const { supabase, user, error } = await getAuthUser(request);
  if (error || !user) return error!;

  const { data, error: listError } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at, created_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (listError) {
    return NextResponse.json({ error: "FAILED_TO_LOAD_CONVERSATIONS", details: listError.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const { supabase, user, error } = await getAuthUser(request);
  if (error || !user) return error!;

  const body = await request.json().catch(() => ({}));
  const rawTitle = typeof body?.title === "string" ? body.title.trim() : "";
  const title = (rawTitle || "New conversation").slice(0, 100);

  const { count, error: countError } = await supabase
    .from("ai_conversations")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id);

  if (countError) {
    return NextResponse.json({ error: "FAILED_TO_CHECK_CONVERSATIONS", details: countError.message }, { status: 500 });
  }

  if ((count || 0) >= MAX_CONVERSATIONS_PER_USER) {
    return NextResponse.json(
      { error: "Conversation limit reached. Please delete older conversations." },
      { status: 403 }
    );
  }

  const { data, error: insertError } = await supabase
    .from("ai_conversations")
    .insert({ user_id: user.id, title })
    .select("id, title, updated_at, created_at")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "FAILED_TO_CREATE_CONVERSATION", details: insertError.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
