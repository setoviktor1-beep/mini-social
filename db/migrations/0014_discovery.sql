-- Real server-side discovery: trending hashtags and follow suggestions,
-- computed against the *whole* recent posts/profiles tables (not derived
-- from whatever page of the feed the browser already loaded).
--
-- Both functions are SECURITY INVOKER (the default) and STABLE: they run
-- under the calling session's own role, so the existing posts/profiles RLS
-- policies (status='active', can_view_profile_content — public/owner/
-- admin/accepted-follower, block always overrides follow) apply exactly as
-- they do to any other query that role could run. Muting is a feed
-- preference rather than a visibility/security rule (a muted user's posts
-- are still directly visible, e.g. on their profile — see the mute/unmute
-- test), so it's applied here explicitly, matching how the regular feed
-- query already excludes muted authors in lib/feed-service.ts.

CREATE OR REPLACE FUNCTION public.get_trending_hashtags(
  p_limit INTEGER DEFAULT 8,
  p_window_hours INTEGER DEFAULT 168
)
RETURNS TABLE(tag TEXT, post_count BIGINT, score NUMERIC)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH visible_posts AS (
    SELECT p.id, p.content, p.user_id, p.created_at
    FROM posts p
    WHERE p.created_at > now() - make_interval(hours => GREATEST(p_window_hours, 1))
      AND (
        auth.uid() IS NULL
        OR p.user_id = auth.uid()
        OR NOT EXISTS (
          SELECT 1 FROM mutes m WHERE m.muter_id = auth.uid() AND m.muted_id = p.user_id
        )
      )
      -- RLS on posts already restricts this SELECT to status='active' (or
      -- own/admin) rows whose author is visible to the caller.
  ),
  tags AS (
    SELECT lower(m[1]) AS tag, vp.id AS post_id, vp.created_at
    FROM visible_posts vp,
    LATERAL regexp_matches(vp.content, '#([[:alnum:]_]{2,40})', 'g') AS m
  ),
  engagement AS (
    SELECT
      t.tag,
      t.post_id,
      t.created_at,
      (SELECT count(*) FROM likes l WHERE l.post_id = t.post_id)
        + (SELECT count(*) FROM reactions r WHERE r.post_id = t.post_id)
        + (SELECT count(*) FROM comments c WHERE c.post_id = t.post_id AND c.status <> 'deleted') AS engagement_count
    FROM tags t
  )
  SELECT
    e.tag,
    count(DISTINCT e.post_id) AS post_count,
    -- Recency-decayed engagement: each post contributes (1 + its
    -- engagement) divided by (1 + hours since posted), so a fresh,
    -- lightly-engaged post and an older, heavily-engaged one both have a
    -- real, comparable weight instead of raw counts letting old spam tags
    -- dominate forever.
    sum(
      (1 + e.engagement_count)::numeric
      / (1 + extract(epoch FROM (now() - e.created_at)) / 3600.0)
    ) AS score
  FROM engagement e
  GROUP BY e.tag
  ORDER BY score DESC, e.tag ASC
  LIMIT GREATEST(p_limit, 0)
$$;

-- New functions default to EXECUTE granted to PUBLIC; revoke that so only
-- authenticated (never anonymous) can call them, matching the fact that
-- the homepage that renders trending/suggestions already requires login.
REVOKE EXECUTE ON FUNCTION public.get_trending_hashtags(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_trending_hashtags(INTEGER, INTEGER) TO authenticated;

-- Follow suggestions: excludes the viewer, anyone already followed, and
-- anyone blocked in either direction or muted (RLS on profiles/follows
-- already blocks/allows the right rows for other reasons, but "already
-- followed" and "muted" aren't security properties, so they're filtered
-- explicitly here). Ranked by the suggested account's follower count
-- (a simple, real popularity/relationship signal) with a random tiebreaker
-- so results aren't the same fixed set of early-created accounts forever.
CREATE OR REPLACE FUNCTION public.get_follow_suggestions(
  p_limit INTEGER DEFAULT 3
)
RETURNS TABLE(id UUID, username TEXT, display_name TEXT, avatar_path TEXT, follower_count BIGINT)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    pr.id,
    pr.username,
    pr.display_name,
    pr.avatar_path,
    (SELECT count(*) FROM follows f2 WHERE f2.following_id = pr.id) AS follower_count
  FROM profiles pr
  WHERE (auth.uid() IS NULL OR pr.id <> auth.uid())
    AND (
      auth.uid() IS NULL
      OR NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = auth.uid() AND f.following_id = pr.id)
    )
    AND (
      auth.uid() IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = auth.uid() AND b.blocked_id = pr.id)
           OR (b.blocker_id = pr.id AND b.blocked_id = auth.uid())
      )
    )
    AND (
      auth.uid() IS NULL
      OR NOT EXISTS (SELECT 1 FROM mutes m WHERE m.muter_id = auth.uid() AND m.muted_id = pr.id)
    )
    -- A private account can be suggested (its existence isn't secret),
    -- but its content isn't shown here anyway — this returns profile
    -- fields only, all already public-safe per the profiles RLS read
    -- policy.
  ORDER BY follower_count DESC, random()
  LIMIT GREATEST(p_limit, 0)
$$;

REVOKE EXECUTE ON FUNCTION public.get_follow_suggestions(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_follow_suggestions(INTEGER) TO authenticated;
