-- Restrict notifications inserts to authenticated users acting as themselves.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'System inserts notifications'
  ) THEN
    DROP POLICY "System inserts notifications" ON public.notifications;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Authenticated inserts notifications as self'
  ) THEN
    CREATE POLICY "Authenticated inserts notifications as self"
      ON public.notifications
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = actor_id);
  END IF;
END $$;
