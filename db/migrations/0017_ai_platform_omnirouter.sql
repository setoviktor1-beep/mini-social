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

-- Compatibility alias view for ai_threads
CREATE OR REPLACE VIEW public.ai_threads AS
SELECT id, user_id, title, created_at, updated_at
FROM public.ai_conversations;

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

-- Add missing columns safely if they do not already exist
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public."user"(id) ON DELETE CASCADE;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS input_tokens INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.ai_messages ADD COLUMN IF NOT EXISTS output_tokens INTEGER NOT NULL DEFAULT 0;

-- Backfill user_id from ai_conversations for existing messages without user_id
UPDATE public.ai_messages m
SET user_id = c.user_id
FROM public.ai_conversations c
WHERE m.conversation_id = c.id AND m.user_id IS NULL;

CREATE INDEX IF NOT EXISTS ai_messages_conversation_created_idx 
  ON public.ai_messages(conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS ai_messages_user_created_idx 
  ON public.ai_messages(user_id, created_at DESC) 
  WHERE user_id IS NOT NULL;

-- ============================================================================
-- 3. AI MEMORY (STRICT PER-USER ISOLATION)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.ai_memory (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
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

DROP POLICY IF EXISTS ai_conversations_owner ON public.ai_conversations;
CREATE POLICY ai_conversations_owner ON public.ai_conversations 
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_messages_owner ON public.ai_messages;
CREATE POLICY ai_messages_owner ON public.ai_messages 
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.ai_conversations c
    WHERE c.id = ai_messages.conversation_id AND c.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS ai_memory_owner ON public.ai_memory;
CREATE POLICY ai_memory_owner ON public.ai_memory 
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) 
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS ai_usage_owner ON public.ai_usage;
CREATE POLICY ai_usage_owner ON public.ai_usage 
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS ai_usage_logs_owner ON public.ai_usage_logs;
CREATE POLICY ai_usage_logs_owner ON public.ai_usage_logs 
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

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

GRANT SELECT ON public.ai_threads TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
