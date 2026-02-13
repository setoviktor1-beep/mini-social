import { createSupabaseServerClient } from "@/lib/supabase/server";

export const MAX_CONTEXT_MESSAGES = 20;
export const MAX_CONTEXT_TOKENS = 8000;
export const MAX_USER_MESSAGE_CHARS = 2000;
export const MAX_CONVERSATIONS_PER_USER = 50;

export type ChatMessageRole = "user" | "assistant" | "system";

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};

type StoredMessage = {
  role: ChatMessageRole;
  content: string;
  created_at: string;
};

function estimateTokens(text: string): number {
  return Math.ceil((text || "").length / 4);
}

export async function buildContextWindow(params: {
  conversationId: string;
  newMessage: string;
  systemPrompt: string;
}) {
  const { conversationId, newMessage, systemPrompt } = params;
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase
    .from("ai_messages")
    .select("role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(MAX_CONTEXT_MESSAGES);

  if (error) {
    throw new Error(`Failed to load conversation history: ${error.message}`);
  }

  const history = ((data || []) as StoredMessage[]).slice().reverse();
  const withEstimatedTokens = history.map((m) => ({
    role: m.role,
    content: m.content,
    tokens: estimateTokens(m.content),
  }));

  let totalTokens =
    estimateTokens(systemPrompt) +
    estimateTokens(newMessage) +
    withEstimatedTokens.reduce((sum, m) => sum + m.tokens, 0);

  const trimmed = [...withEstimatedTokens];
  while (totalTokens > MAX_CONTEXT_TOKENS && trimmed.length > 0) {
    const removed = trimmed.shift();
    totalTokens -= removed?.tokens || 0;
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...trimmed.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: newMessage },
  ];

  return { messages, estimatedTokens: totalTokens };
}
