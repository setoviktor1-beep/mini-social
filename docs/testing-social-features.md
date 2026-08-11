# Running the authenticated social-feature tests locally

`tests/social-authenticated.spec.ts` exercises real mutations (create post,
react, bookmark, mute) against a running app + database, so — unlike the
read-only specs in `tests/` — it needs actual infrastructure and two seeded
accounts. This never runs against production; it needs its own isolated
stack.

## 1. Isolated Postgres + PostgREST

```bash
docker network create mini-social-test-net

docker run -d --name mini-social-test-db --network mini-social-test-net \
  -e POSTGRES_DB=mini_social_test -e POSTGRES_USER=test -e POSTGRES_PASSWORD=test \
  -p 15433:5432 postgis/postgis:17-3.5

# wait for it to accept connections, then apply every migration in order
DATABASE_URL="postgresql://test:test@127.0.0.1:15433/mini_social_test" node scripts/migrate.mjs

docker run -d --name mini-social-test-postgrest --network mini-social-test-net \
  -e PGRST_DB_URI="postgresql://authenticator:postgrest@mini-social-test-db:5432/mini_social_test" \
  -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anonymous \
  -e PGRST_JWT_SECRET="<32+ char secret, must match POSTGREST_JWT_SECRET below>" \
  -e PGRST_DB_POOL=30 \
  -e PGRST_SERVER_PORT=3000 \
  -p 13000:3000 \
  postgrest/postgrest:v12.2.12
```

## 2. `.env.local` for the app

```bash
APP_URL=http://127.0.0.1:3000
BETTER_AUTH_URL=http://127.0.0.1:3000
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
AUTH_TRUSTED_ORIGINS=http://127.0.0.1:3000
AUTH_REQUIRE_EMAIL_VERIFICATION=false
DATABASE_URL=postgresql://test:test@127.0.0.1:15433/mini_social_test
DATABASE_POOL_MAX=30
POSTGREST_URL=http://127.0.0.1:13000
POSTGREST_JWT_SECRET=<same secret as PGRST_JWT_SECRET above>
BETTER_AUTH_SECRET=<any 32+ char random string>
NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=false
NEXT_PUBLIC_PASSWORD_RESET_ENABLED=false
```

`APP_URL`/`BETTER_AUTH_URL`/`AUTH_TRUSTED_ORIGINS` must all agree on the
exact origin the app is actually served from — Better Auth rejects
sign-in requests whose `Origin` header isn't in `trustedOrigins`, and the
failure is silent in the UI (the login form just never redirects).

## 3. Build and run the app

`server.mjs` reads `process.env.NODE_ENV` *before* Next loads `.env.local`,
so set it on the command itself, not just in the env file:

```bash
npm run build
NODE_ENV=production node server.mjs
```

Do not use `npm run dev` for this — a dev server that was left running from
an earlier `webServer`-managed Playwright run (e.g. the default config's
`npm run dev` on port 3000) will produce a stale-lockfile conflict, and dev
mode's HMR/hydration overhead has been observed to make composer/button
click handlers unreliable under load. Always confirm nothing else owns
port 3000 first (`ps aux | grep "next dev"`).

## 4. Seed two accounts

```bash
curl -X POST http://127.0.0.1:3000/api/auth/sign-up/email -H "Content-Type: application/json" \
  -d '{"email":"tester-a@example.com","password":"TestPass123!","name":"Tester A"}'
curl -X POST http://127.0.0.1:3000/api/auth/sign-up/email -H "Content-Type: application/json" \
  -d '{"email":"tester-b@example.com","password":"TestPass123!","name":"Tester B"}'
```

`tests/social-authenticated.spec.ts` expects exactly these two accounts.

## 5. Run the suite

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/social-authenticated.spec.ts
```

Passing `PLAYWRIGHT_BASE_URL` makes the Playwright config skip its own
`webServer` (which otherwise defaults to `npm run dev`) and point at the
server you started in step 3.

Between repeated runs, clear accumulated posts so the feed stays fast to
render (every `PostCard` fetches its own comments on mount — an N+1 query
pattern that gets progressively slower as posts pile up):

```bash
docker exec mini-social-test-db psql -U test -d mini_social_test \
  -c "TRUNCATE posts, comments, reposts, reactions, likes, bookmarks, mutes, notifications RESTART IDENTITY CASCADE;"
```

## Notes on flakiness on a shared host

If this runs on a machine that's also serving other workloads (as it did
during development — the same VPS hosts the live production stack plus
unrelated concurrent processes), individual actions can occasionally take
far longer than they do on an idle machine, even though the underlying
mutation is confirmed instant and correct via direct `curl` calls to
`/api/data/query`. `playwright.config.ts` sets a generous `expect.timeout`
and `actionTimeout` for this reason. If a test still times out twice in a
row on an otherwise-idle machine, treat it as a real regression, not
environment noise.

## Nested replies are a separate backend blocker

The current `comments` table is intentionally flat. Its schema does not
include `parent_comment_id`, so the client must not select, filter, or insert
that column. Reply controls and nested-reply tests remain disabled until a
reviewed database migration and matching backend/RLS behavior are available;
flat comment loading, pagination, creation, editing, deletion, reporting, and
retry states continue to be supported.
