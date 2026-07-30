BEGIN;

DROP TRIGGER IF EXISTS profiles_protect_privileges ON public.profiles;
DROP TRIGGER IF EXISTS service_requests_protect_owners ON public.service_requests;
DROP FUNCTION IF EXISTS public.prevent_privilege_or_owner_change();

COMMIT;
