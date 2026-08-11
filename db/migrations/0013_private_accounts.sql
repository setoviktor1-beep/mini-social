BEGIN;

-- Private accounts. Additive and backward-compatible: every existing
-- profile gets is_private = false, meaning every existing account stays
-- exactly as visible as it is today, and every existing follows row is
-- untouched (switching to private later does not retroactively revoke
-- existing followers — see enforce_follow_request below, which only
-- gates *new* follow attempts).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

-- One-way follow-approval workflow, distinct from the existing mutual
-- `friend_requests` table (that's a separate, symmetric "friends"
-- relationship — unrelated to this). A follow_requests row represents
-- "requester wants to follow target"; once accepted, a `follows` row is
-- created by the trigger below. Public-target follows never go through
-- this table at all (see enforce_follow_request).
CREATE TABLE IF NOT EXISTS follow_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id),
  CHECK (requester_id <> target_id)
);

CREATE INDEX IF NOT EXISTS follow_requests_target_idx ON follow_requests(target_id, status);

ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follow_requests_participant_read ON follow_requests;
CREATE POLICY follow_requests_participant_read ON follow_requests FOR SELECT TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid() OR is_admin_or_mod());

DROP POLICY IF EXISTS follow_requests_requester_insert ON follow_requests;
CREATE POLICY follow_requests_requester_insert ON follow_requests FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

-- Only the target may change status (accept/reject); the requester may
-- delete their own pending request (cancel) — handled by the DELETE
-- policy below, not UPDATE, so a requester can never flip status to
-- 'accepted' themselves.
DROP POLICY IF EXISTS follow_requests_target_update ON follow_requests;
CREATE POLICY follow_requests_target_update ON follow_requests FOR UPDATE TO authenticated
  USING (target_id = auth.uid() OR is_admin_or_mod())
  WITH CHECK (target_id = auth.uid() OR is_admin_or_mod());

DROP POLICY IF EXISTS follow_requests_participant_delete ON follow_requests;
CREATE POLICY follow_requests_participant_delete ON follow_requests FOR DELETE TO authenticated
  USING (requester_id = auth.uid() OR target_id = auth.uid() OR is_admin_or_mod());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_requests TO authenticated;
GRANT ALL ON public.follow_requests TO service_role;

-- Enforces that a private account can only gain a new follower through
-- the request/accept workflow — a client cannot bypass approval by
-- POSTing directly to `follows`. Public-target follows are unaffected
-- (unchanged instant-follow behavior). The materializing-follow session
-- flag exempts materialize_accepted_follow's own INSERT below, since that
-- insert *is* the legitimate accepted-request path and must not be
-- rejected by this same check.
CREATE OR REPLACE FUNCTION public.enforce_follow_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_is_private BOOLEAN;
  has_accepted_request BOOLEAN;
BEGIN
  IF current_setting('minisocial.materializing_follow', true) = 'true' THEN
    RETURN NEW;
  END IF;

  SELECT is_private INTO target_is_private FROM profiles WHERE id = NEW.following_id;
  IF NOT COALESCE(target_is_private, false) THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM follow_requests
    WHERE requester_id = NEW.follower_id AND target_id = NEW.following_id AND status = 'accepted'
  ) INTO has_accepted_request;

  IF NOT has_accepted_request THEN
    RAISE EXCEPTION 'follow_requires_accepted_request';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enforce_follow_request ON follows;
CREATE TRIGGER enforce_follow_request
  BEFORE INSERT ON follows
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_follow_request();

-- When a follow_request transitions to 'accepted', materialize the actual
-- `follows` row. This is the *only* normal path a private account's
-- follows row is created through.
CREATE OR REPLACE FUNCTION public.materialize_accepted_follow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM set_config('minisocial.materializing_follow', 'true', true);
    INSERT INTO follows (follower_id, following_id)
    VALUES (NEW.requester_id, NEW.target_id)
    ON CONFLICT (follower_id, following_id) DO NOTHING;
    PERFORM set_config('minisocial.materializing_follow', 'false', true);
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS materialize_accepted_follow ON follow_requests;
CREATE TRIGGER materialize_accepted_follow
  BEFORE INSERT OR UPDATE ON follow_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.materialize_accepted_follow();

-- Central visibility check, used by posts/post_media/comments RLS below.
-- SECURITY DEFINER so it always sees the real follows/blocks/profiles
-- state regardless of the querying role's own RLS view of those tables.
--
-- Block always overrides follow: a blocked relationship hides content
-- even if an accepted follow exists on either side.
CREATE OR REPLACE FUNCTION public.can_view_profile_content(profile_owner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN auth.uid() IS NULL THEN
        -- Anonymous visitors can see public accounts' content only.
        NOT COALESCE((SELECT is_private FROM profiles WHERE id = profile_owner_id), false)
      WHEN auth.uid() = profile_owner_id THEN true
      WHEN is_admin_or_mod() THEN true
      WHEN EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocker_id = auth.uid() AND blocked_id = profile_owner_id)
           OR (blocker_id = profile_owner_id AND blocked_id = auth.uid())
      ) THEN false
      WHEN NOT COALESCE((SELECT is_private FROM profiles WHERE id = profile_owner_id), false) THEN true
      ELSE EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = auth.uid() AND following_id = profile_owner_id
      )
    END
$$;

DROP POLICY IF EXISTS posts_read ON posts;
CREATE POLICY posts_read ON posts FOR SELECT
  USING (
    (status = 'active' OR user_id = auth.uid() OR is_admin_or_mod())
    AND public.can_view_profile_content(user_id)
  );

-- post_media was previously fully public (USING (true)), independent of
-- the parent post's own visibility — a real gap even before private
-- accounts existed (a deleted or otherwise-hidden post's media was still
-- directly queryable). Fixed to follow the parent post's visibility
-- exactly, consistent with "media... protected consistently".
DROP POLICY IF EXISTS post_media_read ON post_media;
CREATE POLICY post_media_read ON post_media FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
        AND (posts.status = 'active' OR posts.user_id = auth.uid() OR is_admin_or_mod())
        AND public.can_view_profile_content(posts.user_id)
    )
  );

-- comments_read (from 0010_nested_comments.sql) gates on the comment's
-- own status/ownership/blocks — extend it to also require the *post's*
-- author be visible to the viewer, so a private account's post can't be
-- read indirectly through its comments. Comment authorship doesn't factor
-- into a private account's gate (a public user's comment on a private
-- account's post is still hidden — the post itself is the private
-- content). Reuses public.comment_has_replies() for the tombstone check,
-- same as 0010 — an inline self-referencing EXISTS subquery here would
-- reintroduce the exact "infinite recursion detected in policy" failure
-- that function exists to avoid.
DROP POLICY IF EXISTS comments_read ON comments;
CREATE POLICY comments_read ON comments FOR SELECT
  USING (
    (
      status = 'active'
      OR user_id = auth.uid()
      OR is_admin_or_mod()
      OR (status = 'deleted' AND public.comment_has_replies(id))
    )
    AND (
      auth.uid() IS NULL
      OR user_id = auth.uid()
      OR is_admin_or_mod()
      OR NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = comments.user_id)
           OR (b.blocker_id = comments.user_id AND b.blocked_id = auth.uid())
      )
    )
    AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = comments.post_id
        AND public.can_view_profile_content(posts.user_id)
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
