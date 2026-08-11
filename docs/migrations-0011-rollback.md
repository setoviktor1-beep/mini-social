# Rollback / recovery: migration 0011 (video posts)

Same forward-only runner as documented in
`docs/migrations-0006-0008-rollback.md`.

`0011_video_posts.sql` adds one column (`post_media.media_type`, `NOT NULL
DEFAULT 'image'`) and a CHECK constraint. It does not touch any existing
row's data — every pre-existing `post_media` row becomes `media_type =
'image'`, which is what it already was. Rollback cannot lose data.

## Before rolling back

1. Take a database backup (or confirm the automated backup has a recent
   snapshot) regardless of how low-risk this looks.
2. Deploy the previous application build first — the composer's video
   upload path and PostCard's `<video>` rendering will error against a
   database missing `media_type`.
3. If any `media_type = 'video'` rows exist (real video posts users have
   created since this shipped), decide what should happen to them before
   rolling back. The rollback below does not delete the underlying video
   files in object storage or the `post_media` rows themselves — it only
   drops the column that says which kind of media they are. If the app
   code is also rolled back to a pre-video build, those objects become
   inert (uploaded files that no UI links to) rather than lost, and can be
   cleaned up manually afterward.

## 0011_video_posts.sql

```sql
BEGIN;

ALTER TABLE post_media DROP CONSTRAINT IF EXISTS post_media_media_type_check;
ALTER TABLE post_media DROP COLUMN IF EXISTS media_type;

NOTIFY pgrst, 'reload schema';

COMMIT;
```
