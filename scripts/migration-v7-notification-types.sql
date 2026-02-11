-- Extend notifications enum-like checks for mention/share/repost and discussion targets.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications
      DROP CONSTRAINT IF EXISTS notifications_type_check;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (
        type IN ('like', 'comment', 'follow', 'new_post', 'mention', 'share', 'repost')
      );

    ALTER TABLE public.notifications
      DROP CONSTRAINT IF EXISTS notifications_target_type_check;

    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_target_type_check
      CHECK (
        target_type IS NULL OR target_type IN ('post', 'comment', 'user', 'discussion')
      );
  END IF;
END $$;

