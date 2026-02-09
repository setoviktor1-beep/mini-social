-- notifications table + RLS + realtime

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'new_post')),
  actor_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  target_id UUID,
  target_type TEXT CHECK (target_type IN ('post', 'comment', 'user')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can see their own notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users see own notifications'
  ) THEN
    CREATE POLICY "Users see own notifications"
      ON notifications
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Allow inserts (app inserts notifications from the client). Consider tightening later.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'System inserts notifications'
  ) THEN
    CREATE POLICY "System inserts notifications"
      ON notifications
      FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Users can mark their own notifications as read
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'Users mark own as read'
  ) THEN
    CREATE POLICY "Users mark own as read"
      ON notifications
      FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

