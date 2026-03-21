-- 20260321173000_add_business_details.sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_category TEXT,
  ADD COLUMN IF NOT EXISTS business_description TEXT;
