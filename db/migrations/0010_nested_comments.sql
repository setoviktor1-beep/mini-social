BEGIN;

-- Nested replies for comments. Additive only: every existing comment keeps
-- parent_comment_id = NULL (top-level), matching its current behavior
-- exactly. No existing row is touched, no column is dropped, no data is
-- deleted.

ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID
  REFERENCES comments(id) ON DELETE SET NULL;

-- depth is derived (0 = top-level, 1 = reply, 2 = reply-to-reply) and
-- maintained by the trigger below, not settable directly by clients. It
-- exists as a stored column (rather than computed at query time via a
-- recursive CTE on every read) so the depth cap below is a cheap trigger
-- check and the UI can order/indent without a recursive query.
ALTER TABLE comments ADD COLUMN IF NOT EXISTS depth SMALLINT NOT NULL DEFAULT 0;

-- A comment can never be its own parent. Simple same-row column check —
-- NEW.id is already populated (from the column DEFAULT) by the time this
-- is evaluated, since defaults are applied before CHECK constraints run.
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_no_self_parent;
ALTER TABLE comments ADD CONSTRAINT comments_no_self_parent
  CHECK (parent_comment_id IS DISTINCT FROM id);

-- Supported nesting depth: top-level (0), reply (1), reply-to-reply (2).
-- Chosen to match the common "one level of nested replies" pattern used by
-- most social apps' comment UIs — deep infinite threading is both a
-- rendering/indentation problem and a moderation-visibility problem UI
-- doesn't yet solve, so it's capped rather than left unbounded.
--
-- Cross-row checks (same post as parent, depth cap, no cycles) cannot be
-- expressed as plain CHECK constraints — they need to read other rows —
-- so they're enforced in this BEFORE trigger instead.
CREATE OR REPLACE FUNCTION public.enforce_comment_nesting()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  parent_post_id UUID;
  parent_depth SMALLINT;
  ancestor_id UUID;
  hops INTEGER := 0;
BEGIN
  IF NEW.parent_comment_id IS NULL THEN
    NEW.depth := 0;
    RETURN NEW;
  END IF;

  SELECT post_id, depth INTO parent_post_id, parent_depth
  FROM comments WHERE id = NEW.parent_comment_id;

  IF parent_post_id IS NULL THEN
    RAISE EXCEPTION 'comment_parent_not_found';
  END IF;

  -- A reply must belong to the same post as its parent — otherwise a
  -- comment thread could be spliced across unrelated posts.
  IF parent_post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'comment_parent_post_mismatch';
  END IF;

  IF parent_depth >= 2 THEN
    RAISE EXCEPTION 'comment_nesting_too_deep';
  END IF;

  NEW.depth := parent_depth + 1;

  -- Cycle guard: walk the new parent's ancestor chain; if this row's own
  -- id appears, re-parenting would create a cycle. A fresh INSERT's id
  -- can't already be anyone's ancestor (it didn't exist yet), so this only
  -- matters for UPDATE (re-parenting an existing comment) — checked
  -- unconditionally anyway for defense in depth. Bounded by the depth cap
  -- (at most 2 hops) plus one guard hop, so this is always cheap.
  ancestor_id := NEW.parent_comment_id;
  WHILE ancestor_id IS NOT NULL AND hops < 10 LOOP
    IF ancestor_id = NEW.id THEN
      RAISE EXCEPTION 'comment_parent_cycle';
    END IF;
    SELECT parent_comment_id INTO ancestor_id FROM comments WHERE id = ancestor_id;
    hops := hops + 1;
  END LOOP;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS enforce_comment_nesting ON comments;
CREATE TRIGGER enforce_comment_nesting
  BEFORE INSERT OR UPDATE OF parent_comment_id, post_id ON comments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_comment_nesting();

-- Index by post + creation order already exists (comments_post_idx, from
-- 0001_app_schema.sql). Add the parent-lookup and threaded-read indexes
-- this feature actually queries by.
CREATE INDEX IF NOT EXISTS comments_parent_idx ON comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS comments_post_parent_created_idx
  ON comments(post_id, parent_comment_id, created_at);

-- Parent deletion is already a soft delete (status -> 'deleted' via
-- UPDATE, never a real DELETE — see components/PostCard.tsx deleteComment)
-- so parent_comment_id on existing replies is never invalidated by a
-- delete; ON DELETE SET NULL on the FK above only matters for the
-- service_role/admin hard-delete path, where it degrades a reply to
-- top-level rather than leaving a dangling reference.
--
-- The orphan-context problem this migration must still solve: the
-- existing comments_read policy hides status='deleted' rows from everyone
-- except their owner/admin — so a deleted comment with visible replies
-- would vanish entirely, leaving those replies with no visible parent
-- context ("misleading orphan replies", which the task explicitly
-- disallows). Fix: allow a deleted comment to remain readable *only* when
-- it has at least one reply, so the UI can render a tombstone
-- ("[Komentaras ištrintas]") instead of hiding the thread structure. A
-- deleted leaf comment (no replies) stays fully hidden, unchanged from
-- before this migration.
--
-- This check cannot be an inline `EXISTS (SELECT 1 FROM comments ...)`
-- subquery directly inside the comments_read policy: any query against
-- `comments` (including this subquery, since it targets the same table)
-- re-triggers comments_read to evaluate row visibility, which contains
-- the same subquery again — Postgres detects this as infinite recursion
-- ("infinite recursion detected in policy for relation comments", 42P17)
-- and refuses to plan the query at all. The fix is the same pattern
-- already used by is_admin_or_mod() elsewhere in this schema: a
-- SECURITY DEFINER function evaluates the check with the function
-- owner's privileges rather than the querying role's, so it bypasses RLS
-- entirely instead of re-entering this policy.
CREATE OR REPLACE FUNCTION public.comment_has_replies(p_comment_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM comments WHERE parent_comment_id = p_comment_id)
$$;

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
  );

-- comments_owner (FOR ALL, from 0002_functions_and_rls.sql) already covers
-- INSERT/UPDATE/DELETE authorization (owner or admin/mod) and needs no
-- change — it applies identically to replies, since parent_comment_id
-- doesn't change who owns a row. No new GRANTs needed either: comments
-- already has table-level SELECT/INSERT/UPDATE/DELETE to authenticated and
-- SELECT to anonymous from 0001/0002, and Postgres table grants cover all
-- columns (including the new ones) unless column-level privileges are
-- used, which they aren't here.

NOTIFY pgrst, 'reload schema';

COMMIT;
