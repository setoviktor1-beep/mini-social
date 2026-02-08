-- ============================================
-- MIGRATION V2: Security fixes + Discussions + Messenger
-- ============================================

-- =====================
-- 1. SECURITY FIXES
-- =====================

-- Reports: users can insert reports but only view their own (admins see all)
CREATE POLICY "Insert own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "View own reports" ON public.reports
  FOR SELECT USING (auth.uid() = reporter_id OR public.is_admin_or_mod());

-- Mods can update reports
CREATE POLICY "Mods update reports" ON public.reports
  FOR UPDATE USING (public.is_admin_or_mod());

-- Prevent suspended users from posting
CREATE OR REPLACE FUNCTION public.check_not_suspended()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_suspended = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profiles: prevent users from changing their own role
CREATE POLICY "Prevent role self-change" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (
    role = (SELECT role FROM public.profiles WHERE id = auth.uid())
  );

-- =====================
-- 2. DISCUSSIONS
-- =====================

-- Discussion topics/threads
CREATE TABLE IF NOT EXISTS public.discussions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) >= 3 AND char_length(title) <= 200),
  content TEXT CHECK (char_length(content) <= 5000),
  category TEXT DEFAULT 'general' CHECK (category IN ('general', 'help', 'offtopic', 'feedback', 'news')),
  is_pinned BOOLEAN DEFAULT false,
  is_locked BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discussion replies
CREATE TABLE IF NOT EXISTS public.discussion_replies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  discussion_id UUID REFERENCES public.discussions(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for discussions
ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discussion_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View active discussions" ON public.discussions
  FOR SELECT USING (status = 'active');

CREATE POLICY "Insert own discussions" ON public.discussions
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.check_not_suspended());

CREATE POLICY "Update own discussions" ON public.discussions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Mods update discussions" ON public.discussions
  FOR UPDATE USING (public.is_admin_or_mod());

CREATE POLICY "View active replies" ON public.discussion_replies
  FOR SELECT USING (status = 'active');

CREATE POLICY "Insert own replies" ON public.discussion_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id AND public.check_not_suspended());

CREATE POLICY "Update own replies" ON public.discussion_replies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Mods update replies" ON public.discussion_replies
  FOR UPDATE USING (public.is_admin_or_mod());

-- Index for faster discussion queries
CREATE INDEX IF NOT EXISTS idx_discussions_created ON public.discussions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion ON public.discussion_replies(discussion_id, created_at);

-- =====================
-- 3. PRIVATE MESSENGER
-- =====================

-- Conversations (between 2 users)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id <> user2_id)
);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL CHECK (char_length(content) <= 2000),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for messenger
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own conversations
CREATE POLICY "View own conversations" ON public.conversations
  FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can create conversations they're part of
CREATE POLICY "Create own conversations" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user1_id AND public.check_not_suspended());

-- Update own conversations (for last_message_at)
CREATE POLICY "Update own conversations" ON public.conversations
  FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Users can only see messages in their conversations
CREATE POLICY "View own messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

-- Users can send messages in their conversations
CREATE POLICY "Send own messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND public.check_not_suspended()
    AND EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
  );

-- Users can update read status on messages sent to them
CREATE POLICY "Mark messages read" ON public.messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE id = conversation_id
      AND (user1_id = auth.uid() OR user2_id = auth.uid())
    )
    AND sender_id <> auth.uid()
  );

-- Indexes for messenger performance
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON public.conversations(user1_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON public.conversations(user2_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON public.messages(conversation_id, is_read) WHERE is_read = false;

-- Helper function: get or create conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  uid UUID := auth.uid();
  u1 UUID;
  u2 UUID;
BEGIN
  -- Always store smaller UUID as user1 for consistency
  IF uid < other_user_id THEN
    u1 := uid; u2 := other_user_id;
  ELSE
    u1 := other_user_id; u2 := uid;
  END IF;

  -- Try to find existing
  SELECT id INTO conv_id FROM public.conversations
  WHERE user1_id = u1 AND user2_id = u2;

  -- Create if not exists
  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id)
    VALUES (u1, u2)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable Realtime for messages (for live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
