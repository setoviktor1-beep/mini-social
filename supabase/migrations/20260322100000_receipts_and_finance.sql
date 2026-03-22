-- Receipt scanning (Enterprise)
CREATE TABLE IF NOT EXISTS public.receipts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  image_url    TEXT,
  vendor       TEXT,
  amount       NUMERIC(10, 2),
  category     TEXT,
  receipt_date DATE,
  raw_text     TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts_self" ON public.receipts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Financial settings (Pro + Enterprise)
CREATE TABLE IF NOT EXISTS public.financial_settings (
  user_id       UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  gpm_percent   NUMERIC(5, 2) DEFAULT 15,
  sodra_percent NUMERIC(5, 2) DEFAULT 12.52,
  pvm_percent   NUMERIC(5, 2) DEFAULT 21,
  is_pvm_payer  BOOLEAN DEFAULT false,
  business_type TEXT DEFAULT 'individual',
  updated_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.financial_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fin_settings_self" ON public.financial_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Monthly income (manual input)
CREATE TABLE IF NOT EXISTS public.monthly_income (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,
  amount     NUMERIC(10, 2) NOT NULL DEFAULT 0,
  note       TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.monthly_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monthly_income_self" ON public.monthly_income
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
