# Rollback / recovery: migration 0014 (discovery: trending + follow suggestions)

Same forward-only runner as documented in
`docs/migrations-0006-0008-rollback.md`.

`0014_discovery.sql` adds two `SECURITY INVOKER` SQL functions,
`public.get_trending_hashtags(limit, window_hours)` and
`public.get_follow_suggestions(limit)`, plus their `GRANT`/`REVOKE`
statements. It does not add, remove, or modify any table, column, or row.
Both functions are read-only (no writes, no side effects) and run under
the calling session's own role, so they carry no elevated privileges and
enforce the same RLS as any other query that role could already run.

## Before rolling back

Deploy the previous application build first: `app/page.tsx` calls
`supabase.rpc('get_trending_hashtags', ...)` and
`supabase.rpc('get_follow_suggestions', ...)`, and `/api/data/query`'s
`allowedRpc` set lists both names — a build that expects them will error
if the functions are gone.

## Rollback SQL

```sql
BEGIN;

DROP FUNCTION IF EXISTS public.get_trending_hashtags(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS public.get_follow_suggestions(INTEGER);

COMMIT;
```

No `schema_migrations` row needs manual cleanup beyond what the runner
already tracks; a redeploy of the previous build combined with this SQL
fully reverts the change.

## Verification after rollback

```sql
SELECT proname FROM pg_proc WHERE proname IN ('get_trending_hashtags', 'get_follow_suggestions');
-- expect: 0 rows
```

Confirm the app no longer references either RPC name (the previous build
uses the old client-derived `buildTrendingFromPosts` and a plain
`profiles` query instead).

## Notes

- Both functions are additive and side-effect-free, so forward-applying
  0014 again after a rollback is always safe (`CREATE OR REPLACE
  FUNCTION` + idempotent `REVOKE`/`GRANT`).
- Neither function was ever granted to the `anonymous` role (the
  homepage that calls them already requires a logged-in user), so there
  is no anonymous-access surface to reason about during rollback.
