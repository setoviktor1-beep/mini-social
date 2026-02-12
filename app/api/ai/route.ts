import { NextResponse } from "next/server";
import { calcCostEUR } from "@/lib/pricing";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type AIFeature = "improve_post" | "generate_reply" | "toxicity_gate";

interface AIRequestBody {
  feature?: AIFeature;
  text?: string;
  context?: string;
}

const MODEL = "gemini-2.5-flash-lite";
const MAX_OUTPUT_TOKENS = 384;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function buildPrompt(feature: AIFeature, text: string, context?: string): string {
  if (feature === "improve_post") {
    return [
      "Rewrite the user text to be clearer and more engaging.",
      "Keep original meaning.",
      "Output only rewritten text, no explanations.",
      "",
      `TEXT:\n${text}`,
    ].join("\n");
  }

  if (feature === "generate_reply") {
    return [
      "Write one short helpful social reply.",
      "Output only the reply text.",
      "",
      context ? `CONTEXT:\n${context}\n` : "",
      `POST:\n${text}`,
    ].join("\n");
  }

  return [
    "Classify toxicity of the text.",
    "Return STRICT JSON object with keys: ok(boolean), reason(string), suggestion(string).",
    "If text is safe: ok=true and empty reason/suggestion.",
    "If toxic: ok=false with short reason and safer rewrite suggestion.",
    "",
    `TEXT:\n${text}`,
  ].join("\n");
}

async function countTokens(apiKey: string, prompt: string): Promise<number> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:countTokens?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    }
  );
  if (!res.ok) return 0;
  const json = await res.json();
  return Number(json?.totalTokens || 0) || 0;
}

export async function POST(request: Request) {
  console.log("AI_ROUTE_START");

  try {
    let body: AIRequestBody;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: "INVALID_JSON", details: getErrorMessage(error) },
        { status: 400 }
      );
    }

    console.log("AI_BODY_PARSED:", body);

    const feature = body?.feature;
    const text = (body?.text || "").trim();
    const context = (body?.context || "").trim();

    if (!feature || !["improve_post", "generate_reply", "toxicity_gate"].includes(feature)) {
      return NextResponse.json({ error: "INVALID_FEATURE" }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "TEXT_REQUIRED" }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "UNAUTHORIZED", details: authError?.message || "No active session" },
        { status: 401 }
      );
    }

    console.log("AI_USER:", user.id);

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: "PROFILE_NOT_FOUND", details: profileError?.message || "Missing profile row" },
        { status: 400 }
      );
    }

    const balance = Number(profile.balance || 0);
    console.log("AI_BALANCE_CHECK:", balance);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY_MISSING", details: "GEMINI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const rawPrice = process.env.PRICE_GEMINI_PER_1K;
    const pricePer1K = Number(rawPrice);
    if (!rawPrice || !Number.isFinite(pricePer1K) || pricePer1K < 0) {
      return NextResponse.json(
        { error: "INVALID_PRICE_CONFIG", details: "PRICE_GEMINI_PER_1K is missing or invalid" },
        { status: 500 }
      );
    }

    const prompt = buildPrompt(feature, text, context);
    const estimatedInputTokens = (await countTokens(apiKey, prompt)) || Math.ceil(prompt.length / 4);
    const expectedCost = calcCostEUR(estimatedInputTokens, MAX_OUTPUT_TOKENS, pricePer1K);

    if (!Number.isFinite(expectedCost)) {
      return NextResponse.json(
        { error: "INVALID_COST_CALC", details: "Expected cost produced NaN/invalid value" },
        { status: 500 }
      );
    }

    if (balance < expectedCost) {
      return NextResponse.json(
        { error: "INSUFFICIENT_BALANCE", details: "Not enough balance for this AI call" },
        { status: 402 }
      );
    }

    console.log("AI_CALLING_GEMINI");

    const genRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            temperature: feature === "toxicity_gate" ? 0.1 : 0.6,
          },
        }),
      }
    );

    if (!genRes.ok) {
      const msg = await genRes.text();
      return NextResponse.json({ error: "AI_PROVIDER_ERROR", details: msg }, { status: 502 });
    }

    const genJson = await genRes.json();
    console.log("AI_RESPONSE_OK");
    const outputText =
      genJson?.candidates?.[0]?.content?.parts
        ?.map((p: any) => p?.text ?? "")
        .join("\n")
        .trim() ?? "";

    if (!outputText) {
      return NextResponse.json({ error: "EMPTY_AI_RESPONSE" }, { status: 500 });
    }

    const usage = genJson?.usageMetadata || {};
    let tokensIn = Number(usage.promptTokenCount || 0) || 0;
    let tokensOut = Number(usage.candidatesTokenCount || 0) || 0;

    if (tokensIn <= 0) tokensIn = estimatedInputTokens;
    if (tokensOut <= 0) tokensOut = MAX_OUTPUT_TOKENS;

    const finalCost = calcCostEUR(tokensIn, tokensOut, pricePer1K);
    if (!Number.isFinite(finalCost)) {
      return NextResponse.json(
        { error: "INVALID_COST_CALC", details: "Final cost produced NaN/invalid value" },
        { status: 500 }
      );
    }

    const { data: newBalance, error: chargeError } = await supabase.rpc("charge_ai_usage", {
      p_user_id: user.id,
      p_feature: feature,
      p_model: MODEL,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
      p_cost: finalCost,
    });

    if (chargeError) {
      const message = String(chargeError.message || "");
      if (message.includes("INSUFFICIENT_BALANCE")) {
        return NextResponse.json({ error: "INSUFFICIENT_BALANCE", details: message }, { status: 402 });
      }
      return NextResponse.json({ error: "CHARGE_FAILED", details: message }, { status: 500 });
    }

    return NextResponse.json({
      text: outputText,
      balance: newBalance,
      cost: finalCost,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
    });
  } catch (error) {
    console.error("AI_ROUTE_ERROR", error);
    return NextResponse.json(
      { error: "INTERNAL_ERROR", details: getErrorMessage(error) },
      { status: 500 }
    );
  }
}
