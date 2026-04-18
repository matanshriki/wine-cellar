-- Lock down process_ai_credit_usage: only service_role may execute.
--
-- The function is SECURITY DEFINER and accepts p_user_id from the caller.
-- It was mistakenly granted to "authenticated", which would let any logged-in
-- client invoke the RPC via PostgREST for an arbitrary UUID (IDOR on credits).
--
-- Callers must use the Supabase service role (Express API + edge functions).

REVOKE EXECUTE ON FUNCTION public.process_ai_credit_usage(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  integer,
  numeric,
  jsonb,
  text
) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.process_ai_credit_usage(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  integer,
  numeric,
  jsonb,
  text
) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.process_ai_credit_usage(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  integer,
  numeric,
  jsonb,
  text
) FROM anon;

GRANT EXECUTE ON FUNCTION public.process_ai_credit_usage(
  uuid,
  text,
  integer,
  text,
  text,
  integer,
  integer,
  numeric,
  jsonb,
  text
) TO service_role;
