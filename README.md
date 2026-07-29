# Mini Social

Self-hosted social platform built with Next.js App Router, PostgreSQL, Better Auth,
MinIO, Redis, Socket.IO, Stripe, and Gemini AI.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS
- PostgreSQL 17 + PostGIS (database, RLS, RPC)
- Better Auth (email/password and optional Google OAuth)
- PostgREST (internal data API)
- MinIO (object storage)
- Redis + Socket.IO (real-time events)
- Stripe (wallet top-up / payments)
- Gemini API (AI tools + AI chat)

## Core Features

- Auth (email/password + Google OAuth flow)
- Feed with posts, comments, likes, reposts, quote posts
- Real-time private messaging
- Notifications
- AI tools (improve post, generate reply, toxicity check)
- AI conversations with context window + usage billing
- Admin/moderation pages
- Legal pages (`/legal/privacy`, `/legal/terms`, `/legal/contact`)

## Requirements

- Docker Engine with Compose
- Stripe account (for payments)
- Gemini API key

## Local Setup

1. Create the production environment file and replace all placeholder secrets:

```bash
cp .env.production.example .env.production
```

Alternatively, generate secure core secrets:

```bash
./scripts/generate-production-env.sh .env.production
```

2. Build and start the self-hosted stack:

```bash
docker compose --env-file .env.production build migrate
docker compose --env-file .env.production up -d
```

3. Open:

`http://127.0.0.1:3100`

The production Compose configuration expects a shared external Docker network
named `coolify` for Traefik routing.

## Available Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - run lint checks
- `node scripts/migrate.mjs` - apply pending PostgreSQL migrations
- `./scripts/smoke-test.sh [base-url]` - verify auth, RLS, storage, and cleanup

## Environment Variables

See the deployment template in `.env.production.example`.

Main groups:
- PostgreSQL and PostgREST
- Better Auth
- Redis and MinIO
- Stripe
- Gemini AI
- SMTP, Google OAuth, web push, and app URLs

## Database

- Active SQL migrations are stored in `db/migrations`.
- `scripts/migrate.mjs` records applied files in `schema_migrations`.
- Use RLS policies for new tables.
- The old `supabase/migrations` directory is retained only as migration history
  and is not used by the deployment.

## Deployment

The production target is a VPS running Docker Compose behind Traefik. The
checked-in configuration routes `mini-social.online` and
`www.mini-social.online`, provisions TLS through the existing Traefik
certificate resolver, runs daily PostgreSQL backups, and exposes the app only
on loopback port `3100`.

## Notes

- Pricing is usage-based (EUR) and may change for future usage.
- Keep secrets server-side only (never expose service keys in client code).
