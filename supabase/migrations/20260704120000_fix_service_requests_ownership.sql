-- Fix for service_requests ownership tampering (Sargas Audit Finding 1)
-- Prevents clients/masters from reassigning requests to other users.

CREATE OR REPLACE FUNCTION public.prevent_service_request_ownership_tampering()
RETURNS trigger AS $$
BEGIN
  -- Allow service_role (backend/admin) to change ownership
  IF (current_setting('role') = 'service_role') THEN
    RETURN NEW;
  END IF;

  -- Block any change to client_id or master_id for authenticated users
  IF (NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.master_id IS DISTINCT FROM OLD.master_id) THEN
    RAISE EXCEPTION 'Ownership columns (client_id, master_id) cannot be modified by users.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_service_request_ownership_tampering_trigger ON public.service_requests;

CREATE TRIGGER prevent_service_request_ownership_tampering_trigger
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_service_request_ownership_tampering();
