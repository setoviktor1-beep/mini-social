# Mini Social

Modern social platform built with Next.js App Router, Supabase, Stripe, and Gemini AI.

## Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- Supabase (auth, database, storage, RLS, RPC)
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

- Node.js 18+
- npm
- Supabase project
- Stripe account (for payments)
- Gemini API key

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from template:

```bash
cp .env.local.example .env.local
```

3. Fill required values in `.env.local`.

4. Start development server:

```bash
npm run dev
```

5. Open:

`http://localhost:3000`

## Available Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run start` - run production server
- `npm run lint` - run lint checks

## Environment Variables

See full template in `.env.local.example`.

Main groups:
- Supabase
- Stripe
- Gemini AI
- App URLs
- Google OAuth placeholders

## Supabase

- SQL migrations are stored in `supabase/migrations`.
- Keep schema changes in migration files (do not leave production-only SQL in Dashboard only).
- Use RLS policies for new tables.

## Deployment

Recommended target: Vercel.

Basic flow:
1. Push to GitHub
2. Connect repo in Vercel
3. Add environment variables in Vercel project settings
4. Deploy

## Notes

- Pricing is usage-based (EUR) and may change for future usage.
- Keep secrets server-side only (never expose service keys in client code).
