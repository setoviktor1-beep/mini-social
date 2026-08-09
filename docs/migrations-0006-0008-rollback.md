# Rollback / recovery: migrations 0006–0008

This project's migration runner (`scripts/migrate.mjs`) is forward-only — there
are no paired "down" migrations. This document is the recovery procedure if
`0006_pro_matching_and_radius.sql`, `0007_bookmarks_and_mutes.sql`, or
`0008_reactions.sql` need to be reverted after being applied to a database.

All three are additive (new tables/policies/triggers, or narrowly-scoped
`CREATE OR REPLACE FUNCTION` changes to existing trigger functions). None of
them drop a column, drop a table, or delete rows. Rollback is therefore safe
and cannot lose pre-existing data — the only content that disappears is what
those migrations *added* (rows in the new `bookmarks`/`mutes`/`reactions`
tables, and the reaction-based routing added to `protect_service_request_participants`).

## Before rolling back

1. Take a database backup (or confirm the existing automated backup — see
   `mini-social-backup` container — has a recent snapshot) regardless of how
   low-risk this looks. This is a production database; verify, don't assume.
2. Deploy the previous application build *first* if rolling back schema —
   the app code that shipped alongside 0006–0008 (bookmark button, mute
   button, reaction picker, `reactions(count)` embeds) will error against a
   database that no longer has those tables/columns. Rolling back schema
   before code is live will surface as 500s on the feed, profile, and
   bookmarks pages.

## 0008_reactions.sql

```sql
BEGIN;

-- Rehydrate `likes` from the current `reactions` table BEFORE dropping
-- `reactions`. Since 0008, `sync_reaction_to_likes` only mirrors
-- 'like'-typed rows into `likes` — a user who changed a pre-migration like
-- to love/laugh/etc. has *no* `likes` row anymore, even though they had
-- one before 0008 ran. Rollback is downgrading a richer typed-reaction
-- model back to the old boolean model, so every reaction (regardless of
-- type) is treated as equivalent to a legacy "like": it's the closest
-- available signal to "this user engaged with this post", and skipping
-- this step would silently lose that engagement for anyone who changed
-- their reaction type after migrating.
INSERT INTO likes (user_id, post_id, created_at)
SELECT user_id, post_id, created_at FROM reactions
ON CONFLICT (user_id, post_id) DO NOTHING;

DROP TRIGGER IF EXISTS sync_reaction_to_likes ON reactions;
DROP FUNCTION IF EXISTS public.sync_reaction_to_likes();
DROP TABLE IF EXISTS reactions;

-- 0008 revoked authenticated's direct write access to `likes` as part of
-- the cutover-safety strategy (see that migration's comments). Restore it
-- here — without this, rolling back leaves users unable to like/unlike
-- posts at all, since the pre-0008 client code writes to `likes` directly.
GRANT INSERT, UPDATE, DELETE ON public.likes TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
```

Automated test for this exact sequence (existing like → change to a
non-like reaction → rollback → confirm the `likes` row is restored):
`scripts/test-reactions-rollback.mjs`.

## 0007_bookmarks_and_mutes.sql

```sql
BEGIN;

DROP TABLE IF EXISTS bookmarks;
DROP TABLE IF EXISTS mutes;

COMMIT;
```

No triggers or shared functions were added in 0007, so nothing else to undo.

## 0006_pro_matching_and_radius.sql

This one is not a straight `DROP` — it changed two existing policies and one
existing trigger function. Reverting means restoring the *previous* logic,
not deleting anything:

```sql
BEGIN;

-- Restore the pre-0006 SELECT policy (members-only, no open-job browsing).
DROP POLICY IF EXISTS service_requests_open_visible ON service_requests;

-- Restore the pre-0006 UPDATE policy.
DROP POLICY IF EXISTS service_requests_update ON service_requests;
CREATE POLICY service_requests_update ON service_requests FOR UPDATE TO authenticated
  USING (auth.uid() IN (client_id, master_id, pro_id));

-- Restore the pre-0006 trigger: block ANY change to master_id/pro_id,
-- including claiming an unassigned job (this was the original, more
-- restrictive behavior from 0003 before 0006 relaxed it for claiming).
CREATE OR REPLACE FUNCTION public.protect_service_request_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' THEN
    IF NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.master_id IS DISTINCT FROM OLD.master_id
      OR NEW.pro_id IS DISTINCT FROM OLD.pro_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Service request participants cannot be changed'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

-- Restore the pre-0006 profiles trigger (no radius clamp).
DROP TRIGGER IF EXISTS clamp_pro_radius ON public.profiles;
DROP FUNCTION IF EXISTS public.clamp_pro_radius();

NOTIFY pgrst, 'reload schema';

COMMIT;
```

Reverting 0006 reintroduces the bug it fixed (pros can't browse/claim open
jobs, and `pro_radius_km` is no longer capped to the paid plan) — only do
this if 0006 itself is the cause of an incident, not as a routine rollback.

## After any rollback

```sql
-- Remove the migration record(s) so scripts/migrate.mjs will re-apply them
-- if/when the fix is ready to go forward again.
DELETE FROM public.schema_migrations WHERE name IN (
  '0008_reactions.sql', '0007_bookmarks_and_mutes.sql', '0006_pro_matching_and_radius.sql'
);
```

Then redeploy the application build that predates these migrations, or patch
the current build to stop referencing `bookmarks`/`mutes`/`reactions`.

## Validation performed for this checkpoint

Run against an isolated, throwaway PostgreSQL 17 + PostGIS container — never
against the production database:

- Applied `0000`–`0008` in order from empty; re-ran `scripts/migrate.mjs`
  immediately after — no changes, confirming `schema_migrations` correctly
  prevents re-application (idempotent at the migration-runner level).
- Confirmed via `\d bookmarks`, `\d mutes`, `\d reactions` that PKs,
  FKs (`ON DELETE CASCADE` to `posts`/`profiles`), and the supporting
  indexes (`bookmarks_user_idx`, `mutes_muter_idx`, `reactions_post_idx`)
  exist as declared.
- Confirmed `reactions` correctly backfills existing `likes` rows as
  `'like'`-typed reactions (`INSERT ... SELECT ... FROM likes ON CONFLICT
  DO NOTHING`), and that pre-existing `likes` rows are never deleted or
  modified by 0006–0008.
- `scripts/test-reactions-db.mjs`: automated integration test confirming
  duplicate reactions are rejected (unique_violation on the PK), RLS blocks
  reacting as another user and blocks anonymous writes, and the
  `sync_reaction_to_likes` trigger correctly adds/removes the legacy
  `likes` mirror row on reaction add and type change.
- Found and fixed a real bug during this validation: 0007 and 0008 enabled
  RLS but did not `GRANT` table privileges to the `authenticated` role
  (unlike the bulk `GRANT` loop in `0002_functions_and_rls.sql` that covers
  tables created before it existed) — every write would have failed with
  `permission denied` despite correct RLS policies. Both migrations were
  fixed in place before this checkpoint was pushed (not yet applied to any
  real database, so no separate correction migration was needed).
- Full authenticated Playwright suite (`tests/social-authenticated.spec.ts`)
  exercised create-post, add/change/remove-reaction with count assertions,
  bookmark/unbookmark, and mute/unmute against the app running on top of
  this migrated schema — see that file and `docs/testing-social-features.md`
  for how to reproduce.
- Found and fixed a second issue in Codex review: legacy clients/browser
  tabs could still write directly to `likes` after the 0008 cutover and
  silently diverge from `reactions` (no reverse sync existed). Fixed by
  revoking `authenticated`'s write grant on `likes` and making the mirror
  trigger `SECURITY DEFINER` — see the "cutover safety" comments in
  `0008_reactions.sql`. `scripts/test-reactions-db.mjs` now also verifies:
  a legacy direct `INSERT`/`DELETE` on `likes` as `authenticated` is
  rejected (permission denied, not silently accepted); `likes` has no
  trigger of its own, so a reactions<->likes recursive trigger loop cannot
  exist structurally; and a `likes` delete (even as `service_role`, which
  keeps write access) cannot touch an active non-`'like'` reaction, because
  non-`'like'` reactions never have a `likes` mirror row to begin with.
- `scripts/test-reactions-rollback.mjs`: automated test for the exact
  scenario in the 0008 rollback SQL above — a user likes a post, changes
  that reaction to a non-`'like'` type (which removes the `likes` mirror
  row per the trigger), the documented rollback SQL is executed verbatim,
  and the test confirms the `likes` row exists again afterward with no
  data loss.
