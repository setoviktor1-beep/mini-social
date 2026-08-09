BEGIN;

-- Bookmarks: private per-user saved posts. Never visible to other users,
-- mirrors the likes/(user_id, post_id) shape but access is owner-only
-- (unlike likes, which are public counts).
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS bookmarks_user_idx ON bookmarks(user_id, created_at DESC);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY bookmarks_owner ON bookmarks FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Mutes: hide a user's posts/reposts from the muter's feed without the
-- mutual restrictions of a block (still followable, still able to DM).
-- Only the muter can see who they've muted.
CREATE TABLE IF NOT EXISTS mutes (
  muter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  muted_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (muter_id, muted_id),
  CHECK (muter_id <> muted_id)
);

CREATE INDEX IF NOT EXISTS mutes_muter_idx ON mutes(muter_id);

ALTER TABLE mutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY mutes_owner ON mutes FOR ALL TO authenticated
  USING (muter_id = auth.uid()) WITH CHECK (muter_id = auth.uid());

NOTIFY pgrst, 'reload schema';

COMMIT;
