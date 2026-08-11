# Rollback / recovery: migration 0010 (nested comments)

Same forward-only migration runner as documented in
`docs/migrations-0006-0008-rollback.md` — no paired "down" migration.

`0010_nested_comments.sql` is additive: it adds two nullable/defaulted
columns (`parent_comment_id`, `depth`), two indexes, one trigger function,
and replaces `comments_read` with a version that is a strict superset of
what it allowed before (same visibility, plus deleted-with-replies
tombstones and block exclusion). It does not drop a column, drop a table,
or delete or modify any existing row's `content`, `user_id`, `post_id`, or
`status`. Rollback is safe and cannot lose pre-existing comment data — the
only thing that disappears is nesting metadata this migration added, and
any replies created after it (which become invalid without their parent
reference and must be handled explicitly, see below).

## Before rolling back

1. Take a database backup (or confirm the automated backup — see the
   `mini-social-backup` container — has a recent snapshot) regardless of
   how low-risk this looks. This is a production database; verify, don't
   assume.
2. Deploy the previous application build *first*. The app code that ships
   with this migration (reply button, threaded rendering, tombstone UI)
   will error against a database that no longer has `parent_comment_id`/
   `depth`. Rolling back schema before code is live will surface as 500s
   on any page that renders comments.
3. Decide what happens to replies (`parent_comment_id IS NOT NULL`)
   created *after* this migration shipped, before rolling back. They are
   real user content — the rollback below does not delete them, it only
   flattens them to top-level comments (their `content`/`user_id`/
   `post_id`/`created_at` are preserved, just the threading relationship
   is dropped). If that's undesirable, export those rows first.

## 0010_nested_comments.sql

```sql
BEGIN;

DROP POLICY IF EXISTS comments_read ON comments;
CREATE POLICY comments_read ON comments FOR SELECT
  USING (status = 'active' OR user_id = auth.uid() OR is_admin_or_mod());

DROP FUNCTION IF EXISTS public.comment_has_replies(UUID);

DROP TRIGGER IF EXISTS enforce_comment_nesting ON comments;
DROP FUNCTION IF EXISTS public.enforce_comment_nesting();

DROP INDEX IF EXISTS comments_post_parent_created_idx;
DROP INDEX IF EXISTS comments_parent_idx;

ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_no_self_parent;

-- Flattens every reply to a top-level comment instead of deleting it —
-- see step 3 above before running this if that's not the desired outcome
-- for post-migration replies.
ALTER TABLE comments DROP COLUMN IF EXISTS parent_comment_id;
ALTER TABLE comments DROP COLUMN IF EXISTS depth;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

## Verifying rollback

- `SELECT column_name FROM information_schema.columns WHERE table_name = 'comments';`
  should no longer list `parent_comment_id`/`depth`.
- Existing comment rows (id, content, user_id, post_id, status,
  created_at) are unchanged — confirm row counts and a spot-check of
  `created_at` ordering match pre-rollback.
- The application's comment list/reply UI must be rolled back to the
  pre-0010 build in the same deploy as this rollback (see step 2 above).
