-- Backfill SQL objects that were created directly in Supabase SQL editor.
-- This migration is additive/idempotent and avoids risky policy rewrites.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'new_post', 'mention', 'share', 'repost')),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  target_id UUID,
  target_type TEXT CHECK (target_type IN ('post', 'comment', 'user', 'discussion')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users see own notifications'
  ) THEN
    CREATE POLICY "Users see own notifications"
      ON public.notifications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'System inserts notifications'
  ) THEN
    CREATE POLICY "System inserts notifications"
      ON public.notifications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users mark own as read'
  ) THEN
    CREATE POLICY "Users mark own as read"
      ON public.notifications
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN invalid_object_definition THEN NULL;
    END;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'Users manage own blocks'
  ) THEN
    CREATE POLICY "Users manage own blocks"
      ON public.blocks
      FOR ALL
      USING (auth.uid() = blocker_id)
      WITH CHECK (auth.uid() = blocker_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'blocks' AND policyname = 'Users see if blocked'
  ) THEN
    CREATE POLICY "Users see if blocked"
      ON public.blocks
      FOR SELECT
      USING (auth.uid() = blocked_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON public.blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON public.blocks(blocked_id);

CREATE TABLE IF NOT EXISTS public.reposts (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reposts' AND policyname = 'View reposts'
  ) THEN
    CREATE POLICY "View reposts"
      ON public.reposts
      FOR SELECT
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'reposts' AND policyname = 'Manage own reposts'
  ) THEN
    CREATE POLICY "Manage own reposts"
      ON public.reposts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_reposts_post_id ON public.reposts(post_id);
CREATE INDEX IF NOT EXISTS idx_reposts_user_id ON public.reposts(user_id);

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS quoted_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_posts_quoted_post_id ON public.posts(quoted_post_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'conversations'
  ) THEN
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id UUID)
      RETURNS UUID AS $inner$
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

        IF uid < other_user_id THEN
          u1 := uid;
          u2 := other_user_id;
        ELSE
          u1 := other_user_id;
          u2 := uid;
        END IF;

        SELECT id INTO conv_id
        FROM public.conversations
        WHERE user1_id = u1 AND user2_id = u2;

        IF conv_id IS NULL THEN
          INSERT INTO public.conversations (user1_id, user2_id)
          VALUES (u1, u2)
          RETURNING id INTO conv_id;
        END IF;

        RETURN conv_id;
      END;
      $inner$ LANGUAGE plpgsql SECURITY DEFINER;
    $fn$;
  END IF;
END $$;
