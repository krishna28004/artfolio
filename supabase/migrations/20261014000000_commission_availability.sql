-- Add an owner-controlled intake switch behind the deployment-level release gate.
-- Apply only after the existing commission workflow migrations in an isolated rehearsal.
CREATE TABLE public.commission_intake_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  accepting_requests boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NOT NULL DEFAULT 'system'
);
INSERT INTO public.commission_intake_settings (id, accepting_requests, updated_by)
VALUES (1, false, 'migration') ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.commission_intake_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_intake_settings FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.commission_intake_settings TO service_role;

CREATE TABLE public.commission_intake_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  accepting_requests boolean NOT NULL,
  actor text NOT NULL CHECK (length(btrim(actor)) BETWEEN 1 AND 254),
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.commission_intake_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_intake_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.commission_intake_events TO service_role;

CREATE OR REPLACE FUNCTION public.set_commission_intake_enabled(p_enabled boolean, p_actor text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_value boolean;
BEGIN
  IF p_enabled IS NULL OR p_actor IS NULL OR length(btrim(p_actor)) NOT BETWEEN 1 AND 254 THEN
    RAISE EXCEPTION 'invalid_intake_setting';
  END IF;
  SELECT accepting_requests INTO current_value
    FROM public.commission_intake_settings WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'intake_setting_missing'; END IF;
  IF current_value IS DISTINCT FROM p_enabled THEN
    UPDATE public.commission_intake_settings
      SET accepting_requests = p_enabled, updated_at = now(), updated_by = p_actor WHERE id = 1;
    INSERT INTO public.commission_intake_events (accepting_requests, actor)
      VALUES (p_enabled, p_actor);
  END IF;
  RETURN p_enabled;
END $$;
REVOKE ALL ON FUNCTION public.set_commission_intake_enabled(boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_commission_intake_enabled(boolean, text) TO service_role;
