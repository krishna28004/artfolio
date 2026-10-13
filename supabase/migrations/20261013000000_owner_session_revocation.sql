-- Require the current Supabase session for sensitive owner operations.
-- Apply only to a disposable project until its Auth schema and grants are verified.
CREATE OR REPLACE FUNCTION public.is_owner_session_active(p_session_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id
      AND (s.not_after IS NULL OR s.not_after > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_owner_session_active(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_session_active(uuid,uuid) TO service_role;
