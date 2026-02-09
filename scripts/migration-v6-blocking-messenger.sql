-- Enforce user blocking for messenger at the DB level.
-- Depends on `blocks` table (migration-v5-blocks.sql).

-- Conversations: hide conversations when either party blocked the other
DROP POLICY IF EXISTS "View own conversations" ON public.conversations;
CREATE POLICY "View own conversations" ON public.conversations
  FOR SELECT
  USING (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = user1_id AND b.blocked_id = user2_id)
         OR (b.blocker_id = user2_id AND b.blocked_id = user1_id)
    )
  );

-- Allow either participant to insert conversations (if you rely on direct inserts)
DROP POLICY IF EXISTS "Create own conversations" ON public.conversations;
CREATE POLICY "Create own conversations" ON public.conversations
  FOR INSERT
  WITH CHECK (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND public.check_not_suspended()
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = user1_id AND b.blocked_id = user2_id)
         OR (b.blocker_id = user2_id AND b.blocked_id = user1_id)
    )
  );

DROP POLICY IF EXISTS "Update own conversations" ON public.conversations;
CREATE POLICY "Update own conversations" ON public.conversations
  FOR UPDATE
  USING (
    (auth.uid() = user1_id OR auth.uid() = user2_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = user1_id AND b.blocked_id = user2_id)
         OR (b.blocker_id = user2_id AND b.blocked_id = user1_id)
    )
  );

-- Messages: hide/send/read only if not blocked
DROP POLICY IF EXISTS "View own messages" ON public.messages;
CREATE POLICY "View own messages" ON public.messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = c.user1_id AND b.blocked_id = c.user2_id)
             OR (b.blocker_id = c.user2_id AND b.blocked_id = c.user1_id)
        )
    )
  );

DROP POLICY IF EXISTS "Send own messages" ON public.messages;
CREATE POLICY "Send own messages" ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND public.check_not_suspended()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = c.user1_id AND b.blocked_id = c.user2_id)
             OR (b.blocker_id = c.user2_id AND b.blocked_id = c.user1_id)
        )
    )
  );

DROP POLICY IF EXISTS "Mark messages read" ON public.messages;
CREATE POLICY "Mark messages read" ON public.messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
        AND NOT EXISTS (
          SELECT 1 FROM public.blocks b
          WHERE (b.blocker_id = c.user1_id AND b.blocked_id = c.user2_id)
             OR (b.blocker_id = c.user2_id AND b.blocked_id = c.user1_id)
        )
    )
    AND sender_id <> auth.uid()
  );

-- RPC: prevent creating/opening conversations when blocked.
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
RETURNS UUID AS $$
DECLARE
  conv_id UUID;
  uid UUID := auth.uid();
  u1 UUID;
  u2 UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF uid = other_user_id THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = uid AND b.blocked_id = other_user_id)
       OR (b.blocker_id = other_user_id AND b.blocked_id = uid)
  ) THEN
    RAISE EXCEPTION 'User is blocked';
  END IF;

  -- Always store smaller UUID as user1 for consistency
  IF uid < other_user_id THEN
    u1 := uid; u2 := other_user_id;
  ELSE
    u1 := other_user_id; u2 := uid;
  END IF;

  SELECT id INTO conv_id FROM public.conversations
  WHERE user1_id = u1 AND user2_id = u2;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id)
    VALUES (u1, u2)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

