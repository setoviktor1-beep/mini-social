-- 20260320180000_add_nextdoor_features.sql
-- Enable PostGIS for geolocation
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- Update profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user' CHECK (role IN ('user', 'master', 'admin')),
  ADD COLUMN IF NOT EXISTS location geometry(Point, 4326),
  ADD COLUMN IF NOT EXISTS address_text TEXT,
  ADD COLUMN IF NOT EXISTS business_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT;

CREATE INDEX IF NOT EXISTS profiles_geo_index ON public.profiles USING GIST (location);

-- Add service requests table
CREATE TABLE IF NOT EXISTS public.service_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  master_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  category TEXT,
  estimated_price NUMERIC,
  materials JSONB,
  location geometry(Point, 4326),
  address_text TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS service_req_geo_index ON public.service_requests USING GIST (location);

-- RLS Policies for service_requests
CREATE POLICY "Anyone can insert their own request"
  ON public.service_requests
  FOR INSERT
  WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can view their own requests"
  ON public.service_requests
  FOR SELECT
  USING (auth.uid() = client_id);

CREATE POLICY "Masters can view open requests in their area (simplified: view all open)"
  ON public.service_requests
  FOR SELECT
  USING (
    status = 'open' OR auth.uid() = master_id
  );

CREATE POLICY "Masters can update requests assigned to them"
  ON public.service_requests
  FOR UPDATE
  USING (auth.uid() = master_id OR auth.uid() = client_id);
