# PLAN — Pay-per-use AI (Gemini 2.5 Flash Lite) + Stripe Top-up + Supabase (mini-social)

## Tikslas
Integruoti pay-per-use AI:
- Vartotojas pasipildo balansą per Stripe Checkout (vienkartinis top-up).
- Kiekvienas AI kvietimas nuskaito balansą pagal token usage.
- Sukuriamas usage audit (`usage_logs`).
- Visa kritinė logika vyksta server-side.

Repo struktūra:
- Next.js App Router: `app/`
- UI: `components/`
- Helpers: `lib/`
- Supabase migrations: `supabase/migrations/`

## MVP AI features
1) Improve Post
2) Generate Reply
3) Toxicity Gate

## Monetizacija
- `profiles.balance` (EUR)
- Top-up paketai: €5 / €10 / €20

Kaina:
- `totalTokens = tokens_input + tokens_output`
- `cost = (totalTokens / 1000) * PRICE_GEMINI_PER_1K`
- Apvalinimas: 4 skaičiai po kablelio (`numeric(10,4)`)

Tokenai:
- Pirmenybė: `usageMetadata` iš Gemini atsakymo.
- Fallback: `countTokens` + konservatyvus output estimate.

## DB
- `profiles.balance` papildymas
- `usage_logs` lentelė
- Trigger: auth user -> profile row
- RLS `profiles`/`usage_logs`
- SQL funkcija `charge_ai_usage(...)` atominiam debit + log

## Stripe
- Checkout Session (`mode=payment`)
- `metadata`: `user_id`, `topup_amount`
- Webhook: `checkout.session.completed` -> `profiles.balance += topup_amount`
- Webhook signature verifikacija su raw body

## Endpointai
- `POST /api/stripe/create-checkout`
- `POST /api/stripe/webhook`
- `POST /api/ai`

## ENV
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID_5`
- `STRIPE_PRICE_ID_10`
- `STRIPE_PRICE_ID_20`
- `GEMINI_API_KEY`
- `PRICE_GEMINI_PER_1K`
- `APP_URL`

## Done kriterijai
- Signup -> profile su `balance=0`
- Top-up -> webhook padidina balansą
- AI kvietimas -> nuskaitytas balansas + `usage_logs`
- `balance=0` -> AI endpoint grąžina `402 INSUFFICIENT_BALANCE`
