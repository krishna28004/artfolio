-- Studio access expires one hour after the underlying Supabase sign-in.
-- Rehearse against the exact auth.sessions schema before applying remotely.
CREATE OR REPLACE FUNCTION public.is_owner_session_active(p_session_id uuid, p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.sessions s
    WHERE s.id = p_session_id AND s.user_id = p_user_id
      AND s.created_at > now() - interval '1 hour'
      AND (s.not_after IS NULL OR s.not_after > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_owner_session_active(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_session_active(uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.owner_session_expires_at(p_session_id uuid, p_user_id uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT LEAST(s.created_at + interval '1 hour', COALESCE(s.not_after, 'infinity'::timestamptz))
  FROM auth.sessions s WHERE s.id = p_session_id AND s.user_id = p_user_id;
$$;
REVOKE ALL ON FUNCTION public.owner_session_expires_at(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.owner_session_expires_at(uuid,uuid) TO service_role;

CREATE TABLE public.owner_login_alerts (
  session_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  notified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.owner_login_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_login_alerts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.owner_login_alerts TO service_role;
