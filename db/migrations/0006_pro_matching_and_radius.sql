BEGIN;

-- Allow master/pro/admin users to see *unclaimed* open service requests so
-- they can browse and claim jobs. The previous policy only allowed the
-- client/master/pro already on the row to see it, which silently broke the
-- "browse open jobs" feature for every pro (app/pro/page.tsx, RequestBoard).
CREATE POLICY service_requests_open_visible ON service_requests FOR SELECT TO authenticated
  USING (
    status = 'open'
    AND master_id IS NULL
    AND pro_id IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('master', 'pro', 'admin')
    )
  );

-- Let a qualified pro claim an unassigned open request (RequestBoard.updateStatus
-- sets master_id = auth.uid() on an open row). Reassigning an already-claimed
-- request is still blocked here and by the trigger below.
DROP POLICY IF EXISTS service_requests_update ON service_requests;
CREATE POLICY service_requests_update ON service_requests FOR UPDATE TO authenticated
  USING (
    auth.uid() IN (client_id, master_id, pro_id)
    OR (
      status = 'open'
      AND master_id IS NULL
      AND pro_id IS NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('master', 'pro', 'admin')
      )
    )
  );

-- The 0003 trigger blocked *any* change to master_id/pro_id, which also
-- blocked claiming (NULL -> self). Allow that one transition; keep blocking
-- reassignment away from an existing owner or to someone else.
CREATE OR REPLACE FUNCTION public.protect_service_request_participants()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin_or_mod() THEN
    IF NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Service request participants cannot be changed'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.master_id IS DISTINCT FROM OLD.master_id
      AND (OLD.master_id IS NOT NULL OR NEW.master_id IS DISTINCT FROM auth.uid())
    THEN
      RAISE EXCEPTION 'Service request master cannot be reassigned'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.pro_id IS DISTINCT FROM OLD.pro_id
      AND (OLD.pro_id IS NOT NULL OR NEW.pro_id IS DISTINCT FROM auth.uid())
    THEN
      RAISE EXCEPTION 'Service request pro cannot be reassigned'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$$;

-- Cap profiles.pro_radius_km to the user's paid plan (basic=5, pro=15,
-- enterprise=50). ProSettings.tsx only clamps the slider client-side, so
-- nothing stopped a Basic subscriber from PATCHing pro_radius_km=50 directly
-- against PostgREST and getting Enterprise-level reach for free.
CREATE OR REPLACE FUNCTION public.clamp_pro_radius()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  active_plan TEXT;
  max_km INTEGER;
BEGIN
  IF NEW.pro_radius_km IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'admin' THEN
    RETURN NEW;
  END IF;

  SELECT plan INTO active_plan
  FROM subscriptions
  WHERE user_id = NEW.id AND status IN ('active', 'trialing');

  max_km := CASE active_plan
    WHEN 'enterprise' THEN 50
    WHEN 'pro' THEN 15
    WHEN 'basic' THEN 5
    ELSE 2
  END;

  IF NEW.pro_radius_km > max_km THEN
    NEW.pro_radius_km := max_km;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS clamp_pro_radius ON public.profiles;
CREATE TRIGGER clamp_pro_radius
  BEFORE INSERT OR UPDATE OF pro_radius_km ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.clamp_pro_radius();

NOTIFY pgrst, 'reload schema';

COMMIT;
