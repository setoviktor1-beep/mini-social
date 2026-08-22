-- Allow anonymous role to SELECT from public.blocks so that RLS policies
-- (such as comments_read checking NOT EXISTS (SELECT 1 FROM blocks ...))
-- can be evaluated for unauthenticated visitors without 42501 permission errors.
-- The blocks_visible RLS policy ensures anonymous visitors only see 0 rows.
GRANT SELECT ON public.blocks TO anonymous;
