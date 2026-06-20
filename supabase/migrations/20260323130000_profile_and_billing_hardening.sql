ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS address_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS address_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS travel_mode BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS travel_address_text TEXT,
  ADD COLUMN IF NOT EXISTS travel_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS travel_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS user_radius_km NUMERIC(6,2) NOT NULL DEFAULT 5.0;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_plan_check CHECK (plan IN ('free', 'basic', 'pro', 'enterprise')),
  CONSTRAINT subscriptions_status_check CHECK (
    status IN (
      'inactive',
      'pending',
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_customer_id_idx
  ON public.subscriptions (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx
  ON public.subscriptions (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'Subscriptions select own'
  ) THEN
    CREATE POLICY "Subscriptions select own"
      ON public.subscriptions
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.billing_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkout_type TEXT NOT NULL,
  plan TEXT,
  amount NUMERIC(10,2),
  stripe_session_id TEXT,
  session_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_checkout_sessions_type_check CHECK (checkout_type IN ('wallet', 'subscription')),
  CONSTRAINT billing_checkout_sessions_status_check CHECK (status IN ('pending', 'completed', 'expired', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_checkout_sessions_stripe_session_id_idx
  ON public.billing_checkout_sessions (stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS billing_checkout_sessions_pending_idx
  ON public.billing_checkout_sessions (user_id, checkout_type)
  WHERE status = 'pending';

ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'billing_checkout_sessions' AND policyname = 'Billing checkout sessions own'
  ) THEN
    CREATE POLICY "Billing checkout sessions own"
      ON public.billing_checkout_sessions
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_session_id TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'eur',
  status TEXT NOT NULL DEFAULT 'processing',
  credited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wallet_transactions_status_check CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_stripe_session_id_idx
  ON public.wallet_transactions (stripe_session_id);

ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND policyname = 'Wallet transactions select own'
  ) THEN
    CREATE POLICY "Wallet transactions select own"
      ON public.wallet_transactions
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

ALTER TABLE public.processed_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processing',
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

