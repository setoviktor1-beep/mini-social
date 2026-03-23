CREATE TABLE IF NOT EXISTS public.processed_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  stripe_object_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processed_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.prevent_service_request_party_reassignment()
RETURNS trigger AS $$
DECLARE
  jwt_role TEXT := current_setting('request.jwt.claim.role', true);
BEGIN
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'client_id_update_forbidden';
  END IF;

  IF NEW.master_id IS DISTINCT FROM OLD.master_id THEN
    RAISE EXCEPTION 'master_id_update_forbidden';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_service_request_party_reassignment_trigger ON public.service_requests;

CREATE TRIGGER prevent_service_request_party_reassignment_trigger
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_service_request_party_reassignment();
