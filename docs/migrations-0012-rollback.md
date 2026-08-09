# Rollback / recovery: migration 0012 (link previews)

Same forward-only runner as documented in
`docs/migrations-0006-0008-rollback.md`.

`0012_link_previews.sql` adds one new table (`link_previews`, a pure
server-side fetch cache — no post ever depends on rows in it existing) and
four nullable columns on `posts`. It does not touch any existing row.
Rollback cannot lose post content, comments, or any other data — the only
thing that disappears is preview metadata this migration added.

## Before rolling back

1. Take a database backup (or confirm the automated backup has a recent
   snapshot) regardless of how low-risk this looks.
2. Deploy the previous application build first — the composer's link
   detection/preview fetch and PostCard's preview-card rendering will
   error against a database missing these columns.

## 0012_link_previews.sql

```sql
BEGIN;

ALTER TABLE posts DROP COLUMN IF EXISTS link_preview_url;
ALTER TABLE posts DROP COLUMN IF EXISTS link_preview_title;
ALTER TABLE posts DROP COLUMN IF EXISTS link_preview_description;
ALTER TABLE posts DROP COLUMN IF EXISTS link_preview_image;

DROP POLICY IF EXISTS link_previews_read ON link_previews;
DROP TABLE IF EXISTS link_previews;

NOTIFY pgrst, 'reload schema';

COMMIT;
```
