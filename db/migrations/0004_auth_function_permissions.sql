BEGIN;

GRANT USAGE ON SCHEMA auth TO anonymous, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anonymous, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anonymous, authenticated, service_role;

COMMIT;
