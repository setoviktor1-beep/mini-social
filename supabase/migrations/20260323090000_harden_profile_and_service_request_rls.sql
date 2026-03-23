-- Harden profiles and service_requests access controls.

CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles actor
    WHERE actor.id = auth.uid()
      AND actor.role IN ('admin', 'moderator')
  ) THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.id
    AND (
      COALESCE(to_jsonb(NEW)->>'role', '') IS DISTINCT FROM COALESCE(to_jsonb(OLD)->>'role', '')
      OR COALESCE(to_jsonb(NEW)->>'plan_type', '') IS DISTINCT FROM COALESCE(to_jsonb(OLD)->>'plan_type', '')
    ) THEN
    RAISE EXCEPTION 'role_or_plan_type_update_forbidden';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_profile_privilege_escalation_trigger ON public.profiles;

CREATE TRIGGER prevent_profile_privilege_escalation_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Profiles update own'
  ) THEN
    DROP POLICY "Profiles update own" ON public.profiles;
  END IF;
END $$;

CREATE POLICY "Profiles update own"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Prevent role self-change'
  ) THEN
    DROP POLICY "Prevent role self-change" ON public.profiles;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_requests'
      AND policyname = 'Clients can view their own requests'
  ) THEN
    DROP POLICY "Clients can view their own requests" ON public.service_requests;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_requests'
      AND policyname = 'Masters can view open requests in their area (simplified: view all open)'
  ) THEN
    DROP POLICY "Masters can view open requests in their area (simplified: view all open)" ON public.service_requests;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'service_requests'
      AND policyname = 'Masters can update requests assigned to them'
  ) THEN
    DROP POLICY "Masters can update requests assigned to them" ON public.service_requests;
  END IF;
END $$;

CREATE POLICY "Owners and assigned masters can view service requests"
  ON public.service_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = master_id);

CREATE POLICY "Owners and assigned masters can update service requests"
  ON public.service_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = master_id)
  WITH CHECK (auth.uid() = client_id OR auth.uid() = master_id);
