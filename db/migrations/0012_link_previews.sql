BEGIN;

-- Server-side cache of fetched link-preview metadata, keyed by the exact
-- URL a preview was fetched for. Purely a performance/rate-limit cache for
-- app/api/link-preview/route.ts (the only writer) — the actual per-post
-- preview is a snapshot taken at post-creation time (see the posts columns
-- below), not a live join against this table, so a post's appearance
-- stays stable even if this cache entry is later refreshed or evicted.
CREATE TABLE IF NOT EXISTS link_previews (
  url TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  image_url TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE link_previews ENABLE ROW LEVEL SECURITY;

-- Preview metadata is public (same visibility as post content that
-- references it) and contains nothing user-specific — safe to let anyone
-- read. Only the server (service_role, via app/api/link-preview/route.ts)
-- writes to it; regular users must never be able to insert/update this
-- table directly, since a client-controlled title/description/image_url
-- would defeat the whole point of fetching and sanitizing it server-side.
DROP POLICY IF EXISTS link_previews_read ON link_previews;
CREATE POLICY link_previews_read ON link_previews FOR SELECT USING (true);

GRANT SELECT ON public.link_previews TO authenticated, anonymous;
GRANT ALL ON public.link_previews TO service_role;

-- Per-post snapshot of the preview shown for a link in that post's content.
-- Nullable/additive — every existing post has no preview, unchanged.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_preview_url TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_preview_title TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_preview_description TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS link_preview_image TEXT;

NOTIFY pgrst, 'reload schema';

COMMIT;
