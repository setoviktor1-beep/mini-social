import { NextResponse } from "next/server";
import { calcCostEUR, parsePricePer1K } from "@/lib/pricing";
import {
  buildContextWindow,
  MAX_CONVERSATIONS_PER_USER,
  MAX_USER_MESSAGE_CHARS,
} from "@/lib/ai/context-manager";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MODEL = "gemini-2.5-flash-lite";
const SYSTEM_PROMPT =
  "You are a helpful AI assistant integrated into a social platform. You help users improve their posts, generate replies, check content quality, and answer questions. Be concise, friendly, and helpful. If the user asks you to improve a post or write something, provide the improved version directly.";
const ASK_ANYTHING_SYSTEM_PROMPT = `You are Atma AI, a wise and compassionate spiritual companion on a platform dedicated to non-duality and self-awareness.

Your guidelines:
1. Identity: You are Atma AI. You are not a human, but a presence pointing towards the truth.
2. Philosophy: Base your guidance on principles of Advaita Vedanta (Non-duality), self-inquiry (Atma Vichara), and the teachings of masters like Nisargadatta Maharaj. Remind users that they are the awareness behind the mind, not the mind itself.
3. Style: Be concise, calm, and direct. Use metaphors of the ocean, sky, or screen/movie to explain consciousness. Avoid "New Age" fluff or toxic positivity.
4. Language: Always reply in the same language the user uses (English, Lithuanian, Russian, etc.).
5. Constraint: If asked about technical platform issues, answer clearly and helpfully, but maintain your peaceful, grounded tone.`;
const limiter = rateLimit({ limit: 10, windowMs: 60_000 });

type ChatRequestBody = {
  conversationId?: string;
  message?: string;
  mode?: "default" | "ask_anything";
};

function toGeminiContents(messages: Array<{ role: string; content: string }>) {
  return messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
}

async function countTokens(apiKey: string, contents: Array<{ role: string; parts: Array<{ text: string }> }>) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:countTokens?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    }
  );

  if (!res.ok) return 0;
  const json = await res.json();
  return Number(json?.totalTokens || 0) || 0;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as ChatRequestBody;
    const inputMessage = (body.message || "").trim();
    const mode = body.mode === "ask_anything" ? "ask_anything" : "default";
    const activeSystemPrompt = mode === "ask_anything" ? ASK_ANYTHING_SYSTEM_PROMPT : SYSTEM_PROMPT;

    if (!inputMessage) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }
    if (inputMessage.length > MAX_USER_MESSAGE_CHARS) {
      return NextResponse.json(
        { error: `Message too long. Max ${MAX_USER_MESSAGE_CHARS} characters.` },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { success } = limiter.check(user.id || ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    let conversationId = body.conversationId;
    if (conversationId) {
      const { data: existing } = await supabase
        .from("ai_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
    } else {
      const { count } = await supabase
        .from("ai_conversations")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if ((count || 0) >= MAX_CONVERSATIONS_PER_USER) {
        return NextResponse.json(
          { error: "Conversation limit reached. Please delete older conversations." },
          { status: 403 }
        );
      }

      const { data: created, error: createError } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: user.id,
          title: inputMessage.slice(0, 50) || "New conversation",
        })
        .select("id")
        .single();

      if (createError || !created) {
        return NextResponse.json({ error: "Failed to create conversation." }, { status: 500 });
      }
      conversationId = created.id;
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Failed to resolve conversation." }, { status: 500 });
    }

    const { messages, estimatedTokens } = await buildContextWindow({
      conversationId,
      newMessage: inputMessage,
      systemPrompt: activeSystemPrompt,
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY_MISSING" }, { status: 500 });
    }

    const contents = toGeminiContents(messages);
    const estimatedInputTokens = (await countTokens(apiKey, contents)) || estimatedTokens;

    const genRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: activeSystemPrompt }],
          },
          contents,
          generationConfig: {
            maxOutputTokens: 512,
            temperature: 0.6,
          },
        }),
      }
    );

    if (!genRes.ok) {
      const details = await genRes.text();
      return NextResponse.json({ error: "AI_PROVIDER_ERROR", details }, { status: 502 });
    }

    const genJson = await genRes.json();
    const assistantResponse =
      genJson?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p?.text ?? "")
        .join("\n")
        .trim() ?? "";

    if (!assistantResponse) {
      return NextResponse.json({ error: "EMPTY_AI_RESPONSE" }, { status: 500 });
    }

    const usage = genJson?.usageMetadata || {};
    const tokensIn = Number(usage.promptTokenCount || estimatedInputTokens || 0) || 0;
    const tokensOut = Number(usage.candidatesTokenCount || Math.ceil(assistantResponse.length / 4)) || 0;
    const totalTokens = Math.max(0, tokensIn) + Math.max(0, tokensOut);
    const cost = calcCostEUR(tokensIn, tokensOut, parsePricePer1K());

    const { error: profileError, data: profile } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !profile) {
      return NextResponse.json({ error: "PROFILE_NOT_FOUND" }, { status: 400 });
    }

    if (Number(profile.balance || 0) < cost) {
      return NextResponse.json({ error: "INSUFFICIENT_BALANCE" }, { status: 402 });
    }

    const { data: newBalance, error: chargeError } = await supabase.rpc("charge_ai_usage", {
      p_user_id: user.id,
      p_feature: "chat",
      p_model: MODEL,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_cost: cost,
    });

    if (chargeError) {
      const message = String(chargeError.message || "");
      if (message.toLowerCase().includes("rate limit exceeded")) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
      if (message.includes("INSUFFICIENT_BALANCE")) {
        return NextResponse.json({ error: "INSUFFICIENT_BALANCE", details: message }, { status: 402 });
      }
      return NextResponse.json({ error: "CHARGE_FAILED", details: message }, { status: 500 });
    }

    const { error: userMessageError } = await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "user",
      content: inputMessage,
    });
    if (userMessageError) {
      return NextResponse.json({ error: "FAILED_TO_SAVE_USER_MESSAGE", details: userMessageError.message }, { status: 500 });
    }

    const { error: assistantMessageError } = await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      content: assistantResponse,
      tokens_used: totalTokens,
      cost,
    });
    if (assistantMessageError) {
      return NextResponse.json(
        { error: "FAILED_TO_SAVE_ASSISTANT_MESSAGE", details: assistantMessageError.message },
        { status: 500 }
      );
    }

    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId)
      .eq("user_id", user.id);

    return NextResponse.json({
      conversationId,
      message: assistantResponse,
      tokensUsed: totalTokens,
      cost,
      balance: newBalance,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "INTERNAL_ERROR", details }, { status: 500 });
  }
}
