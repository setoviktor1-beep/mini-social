BEGIN;

-- ============================================================================
-- 1. AI CONVERSATIONS (THREADS) SCHEMA & INDEXES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Naujas pokalbis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_user_updated_idx 
  ON public.ai_conversations(user_id, updated_at DESC);

-- Drop legacy/compatibility ai_threads view if existed to enforce direct ai_conversations RLS
DROP VIEW IF EXISTS public.ai_threads CASCADE;

-- ============================================================================
-- 2. AI MESSAGES EXTENSION & INDEXES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC(10,6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add user_id and model metadata columns safely
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public."user"(id) ON DELETE CASCADE;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS output_tokens INTEGER NOT NULL DEFAULT 0;

-- Backfill user_id from ai_conversations for any existing messages
UPDATE public.ai_messages m
SET user_id = c.user_id
FROM public.ai_conversations c
WHERE m.conversation_id = c.id AND m.user_id IS NULL;

-- Enforce NOT NULL on ai_messages.user_id
ALTER TABLE public.ai_messages ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx 
  ON public.ai_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ai_messages_user_created_idx 
  ON public.ai_messages(user_id, created_at DESC);

-- ============================================================================
-- 3. AI MEMORY (STRICT PER-USER ISOLATION)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_memory (
  user_id UUID PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
  memory JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. DETAILED AI USAGE AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'chat',
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost NUMERIC(10, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_logs_user_created_idx 
  ON public.ai_usage_logs(user_id, created_at DESC);

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- 5.1 ai_conversations: User can only access their own conversations
DROP POLICY IF EXISTS ai_conversations_owner ON public.ai_conversations;
CREATE POLICY ai_conversations_owner ON public.ai_conversations 
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

-- 5.2 ai_messages: Strict user_id and conversation ownership check on both USING and WITH CHECK
DROP POLICY IF EXISTS ai_messages_owner ON public.ai_messages;
CREATE POLICY ai_messages_owner ON public.ai_messages 
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.ai_conversations c
      WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- 5.3 ai_memory: Strict user_id matching auth.uid()
DROP POLICY IF EXISTS ai_memory_owner ON public.ai_memory;
CREATE POLICY ai_memory_owner ON public.ai_memory 
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

-- 5.4 ai_usage: Read-only for authenticated owner
DROP POLICY IF EXISTS ai_usage_owner ON public.ai_usage;
CREATE POLICY ai_usage_owner ON public.ai_usage 
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5.5 ai_usage_logs: Owner can select their logs and insert their own logs with strict WITH CHECK
DROP POLICY IF EXISTS ai_usage_logs_select_owner ON public.ai_usage_logs;
DROP POLICY IF EXISTS ai_usage_logs_insert_owner ON public.ai_usage_logs;
DROP POLICY IF EXISTS ai_usage_logs_owner ON public.ai_usage_logs;

CREATE POLICY ai_usage_logs_select_owner ON public.ai_usage_logs 
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY ai_usage_logs_insert_owner ON public.ai_usage_logs 
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 6. PERMISSIONS & GRANTS
-- ============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memory TO authenticated;
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT SELECT, INSERT ON public.ai_usage_logs TO authenticated;

GRANT ALL ON public.ai_conversations, public.ai_messages, public.ai_memory, 
               public.ai_usage, public.ai_usage_logs TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
