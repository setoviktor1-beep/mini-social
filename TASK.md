# TASK — Pay-per-use AI + Stripe + Supabase (mini-social)

## A. DB/Migrations (Supabase)
- [ ] Sukurti migraciją: `supabase/migrations/20260211_pay_per_use_wallet.sql`
  - [ ] `profiles.balance`
  - [ ] `usage_logs`
  - [ ] trigger: create profile on signup
  - [ ] RLS + policies
  - [ ] `charge_ai_usage(...)` RPC

## B. Stripe (Dashboard)
- [ ] Sukurti 3 Prices:
  - [ ] €5 -> `STRIPE_PRICE_ID_5`
  - [ ] €10 -> `STRIPE_PRICE_ID_10`
  - [ ] €20 -> `STRIPE_PRICE_ID_20`
- [ ] Webhook endpoint: `https://<APP_URL>/api/stripe/webhook`
- [ ] Event: `checkout.session.completed`
- [ ] Nukopijuoti `STRIPE_WEBHOOK_SECRET`

## C. Backend (Next.js App Router)
- [ ] Create: `lib/supabase/server.ts`
- [ ] Create: `lib/stripe.ts`
- [ ] Create: `lib/pricing.ts`
- [ ] Create: `app/api/stripe/create-checkout/route.ts`
- [ ] Create: `app/api/stripe/webhook/route.ts`
- [ ] Create: `app/api/ai/route.ts`

## D. Frontend UI
- [ ] Create: `components/wallet/WalletCard.tsx`
- [ ] Create: `components/ai/AITools.tsx`
- [ ] Integruoti į auth-protected puslapį

## E. Test checklist
- [ ] Signup -> profiles row created
- [ ] Topup €5 -> webhook adds balance
- [ ] Improve Post -> `usage_logs` + balance decreases
- [ ] balance=0 -> `/api/ai` returns 402
