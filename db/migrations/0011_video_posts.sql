BEGIN;

-- Video posts reuse the existing post_media table (same storage adapter,
-- same 'post-images' bucket — see lib/object-storage.ts and
-- app/api/storage/upload/route.ts) rather than introducing a new table or
-- a new bucket. media_type distinguishes how the client should render a
-- row; every existing row is an image, and DEFAULT 'image' preserves that
-- exactly with no backfill needed.
ALTER TABLE post_media ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';

ALTER TABLE post_media DROP CONSTRAINT IF EXISTS post_media_media_type_check;
ALTER TABLE post_media ADD CONSTRAINT post_media_media_type_check
  CHECK (media_type IN ('image', 'video'));

NOTIFY pgrst, 'reload schema';

COMMIT;
