BEGIN;

-- Reactions replace the boolean "like" with a typed reaction per user/post.
-- One row per (user_id, post_id) by construction, so a user cannot hold two
-- simultaneous reactions on the same post — changing reaction type is an
-- UPDATE of the existing row, not a second INSERT.
CREATE TABLE IF NOT EXISTS reactions (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'like'
    CHECK (type IN ('like', 'love', 'laugh', 'wow', 'sad', 'angry')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS reactions_post_idx ON reactions(post_id);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- Reaction counts/types are public (same visibility as the old likes table).
CREATE POLICY reactions_read ON reactions FOR SELECT USING (true);
CREATE POLICY reactions_owner ON reactions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reactions TO authenticated;
GRANT ALL ON public.reactions TO service_role;
GRANT SELECT ON public.reactions TO anonymous;

-- Preserve every existing like by mapping it to the default 'like' reaction.
INSERT INTO reactions (user_id, post_id, type, created_at)
SELECT user_id, post_id, 'like', created_at FROM likes
ON CONFLICT (user_id, post_id) DO NOTHING;

-- Keep the legacy `likes` table (still embedded via `likes(count)` in a few
-- places, and used for the 'like' notification/ranking signal) as a mirror
-- of the 'like'-typed rows in `reactions`, so existing counts/ranking that
-- haven't been migrated to `reactions(count)` stay correct. Only the 'like'
-- reaction type is mirrored; other reaction types are reactions-only.
CREATE OR REPLACE FUNCTION public.sync_reaction_to_likes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM likes WHERE user_id = OLD.user_id AND post_id = OLD.post_id;
    RETURN OLD;
  END IF;

  IF NEW.type = 'like' THEN
    INSERT INTO likes (user_id, post_id, created_at)
    VALUES (NEW.user_id, NEW.post_id, NEW.created_at)
    ON CONFLICT (user_id, post_id) DO NOTHING;
  ELSE
    DELETE FROM likes WHERE user_id = NEW.user_id AND post_id = NEW.post_id;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS sync_reaction_to_likes ON reactions;
CREATE TRIGGER sync_reaction_to_likes
  AFTER INSERT OR UPDATE OF type OR DELETE ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_reaction_to_likes();

NOTIFY pgrst, 'reload schema';

COMMIT;
