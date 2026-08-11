# Rollback / recovery: migration 0013 (private accounts)

Same forward-only runner as documented in
`docs/migrations-0006-0008-rollback.md`.

`0013_private_accounts.sql` adds one column (`profiles.is_private`, `NOT
NULL DEFAULT false`), one new table (`follow_requests`), two triggers, and
tightens three read policies (`posts_read`, `post_media_read`,
`comments_read`) to also check the new `can_view_profile_content()`
function. It does not delete or modify any existing row's data. Every
existing `follows` row is untouched by this migration itself.

## Before rolling back

1. Take a database backup (or confirm the automated backup has a recent
   snapshot) regardless of how low-risk this looks.
2. Deploy the previous application build first — the private-account
   toggle, follow-request UI, and profile-privacy banners will error
   against a database missing `is_private`/`follow_requests`.
3. Decide what happens to any accounts currently set `is_private = true`
   and any pending/accepted `follow_requests` rows before rolling back —
   this migration's rollback drops that state (see below). If any of it
   needs to be preserved for a future re-apply, export it first
   (`SELECT * FROM profiles WHERE is_private; SELECT * FROM
   follow_requests;`).

## 0013_private_accounts.sql

```sql
BEGIN;

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

DROP POLICY IF EXISTS post_media_read ON post_media;
CREATE POLICY post_media_read ON post_media FOR SELECT USING (true);

DROP POLICY IF EXISTS posts_read ON posts;
CREATE POLICY posts_read ON posts FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR is_admin_or_mod());

DROP FUNCTION IF EXISTS public.can_view_profile_content(UUID);

DROP TRIGGER IF EXISTS materialize_accepted_follow ON follow_requests;
DROP FUNCTION IF EXISTS public.materialize_accepted_follow();

DROP TRIGGER IF EXISTS enforce_follow_request ON follows;
DROP FUNCTION IF EXISTS public.enforce_follow_request();

DROP TABLE IF EXISTS follow_requests;

ALTER TABLE profiles DROP COLUMN IF EXISTS is_private;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

## Verifying rollback

- Every profile is publicly visible again (matches pre-0013 behavior).
- Existing `follows` rows are unaffected either way — this migration
  never modified them, only gated *new* inserts to private targets.
