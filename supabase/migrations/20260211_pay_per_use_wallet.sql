-- Pay-per-use wallet and AI usage billing

-- 1) Ensure profiles table exists (for fresh DBs), then ensure balance column exists.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS balance NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 2) Usage logs
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('improve_post', 'generate_reply', 'toxicity_gate')),
  model TEXT NOT NULL,
  tokens_input INT NOT NULL DEFAULT 0,
  tokens_output INT NOT NULL DEFAULT 0,
  cost NUMERIC(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_created
  ON public.usage_logs(user_id, created_at DESC);

-- 3) Trigger for profile creation (idempotent because of ON CONFLICT DO NOTHING)
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_user_profile();

-- 4) RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Profiles select own'
  ) THEN
    CREATE POLICY "Profiles select own"
      ON public.profiles
      FOR SELECT
      USING (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Profiles update own'
  ) THEN
    CREATE POLICY "Profiles update own"
      ON public.profiles
      FOR UPDATE
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_logs' AND policyname = 'Usage logs select own'
  ) THEN
    CREATE POLICY "Usage logs select own"
      ON public.usage_logs
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'usage_logs' AND policyname = 'Usage logs insert own'
  ) THEN
    CREATE POLICY "Usage logs insert own"
      ON public.usage_logs
      FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- 5) Atomic debit + usage log
CREATE OR REPLACE FUNCTION public.charge_ai_usage(
  p_user_id UUID,
  p_feature TEXT,
  p_model TEXT,
  p_tokens_in INT,
  p_tokens_out INT,
  p_cost NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_balance NUMERIC(10,2);
  v_new_balance NUMERIC(10,2);
BEGIN
  IF p_cost < 0 THEN
    RAISE EXCEPTION 'Invalid cost';
  END IF;

  IF p_feature NOT IN ('improve_post', 'generate_reply', 'toxicity_gate') THEN
    RAISE EXCEPTION 'Invalid feature';
  END IF;

  SELECT balance
    INTO v_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND';
  END IF;

  IF v_balance < p_cost THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
  END IF;

  UPDATE public.profiles
  SET balance = balance - p_cost
  WHERE id = p_user_id;

  INSERT INTO public.usage_logs (user_id, feature, model, tokens_input, tokens_output, cost)
  VALUES (p_user_id, p_feature, p_model, GREATEST(p_tokens_in, 0), GREATEST(p_tokens_out, 0), p_cost);

  SELECT balance INTO v_new_balance
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.charge_ai_usage(UUID, TEXT, TEXT, INT, INT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.charge_ai_usage(UUID, TEXT, TEXT, INT, INT, NUMERIC) TO service_role;

-- Atomic top-up helper for webhooks
CREATE OR REPLACE FUNCTION public.credit_wallet_balance(
  p_user_id UUID,
  p_amount NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
  v_new_balance NUMERIC(10,2);
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid topup amount';
  END IF;

  INSERT INTO public.profiles (id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (id)
  DO UPDATE SET balance = public.profiles.balance + EXCLUDED.balance;

  SELECT balance INTO v_new_balance
  FROM public.profiles
  WHERE id = p_user_id;

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.credit_wallet_balance(UUID, NUMERIC) TO service_role;
