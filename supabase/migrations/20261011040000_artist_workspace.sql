-- Owner inbox read state and reusable, editable quote text. No public access.
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS owner_last_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS commission_events_customer_unread_idx
  ON public.commission_events(commission_id, created_at DESC)
  WHERE actor_type = 'customer';

CREATE OR REPLACE FUNCTION public.commission_unread_counts()
RETURNS TABLE(commission_id uuid, unread_count bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, count(e.id)
  FROM public.commissions c
  LEFT JOIN public.commission_events e
    ON e.commission_id = c.id AND e.actor_type = 'customer'
    AND (c.owner_last_seen_at IS NULL OR e.created_at > c.owner_last_seen_at)
  GROUP BY c.id;
$$;
REVOKE ALL ON FUNCTION public.commission_unread_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commission_unread_counts() TO service_role;

CREATE OR REPLACE FUNCTION public.mark_commission_owner_read(p_commission_id uuid, p_seen_through timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE latest_customer_at timestamptz;
BEGIN
  IF p_seen_through IS NULL OR p_seen_through > clock_timestamp() THEN
    RAISE EXCEPTION 'invalid_read_boundary';
  END IF;
  SELECT max(created_at) INTO latest_customer_at
    FROM public.commission_events
    WHERE commission_id = p_commission_id AND actor_type = 'customer'
      AND created_at <= p_seen_through;
  UPDATE public.commissions SET owner_last_seen_at = CASE
    WHEN latest_customer_at IS NULL THEN owner_last_seen_at
    ELSE greatest(coalesce(owner_last_seen_at, latest_customer_at), latest_customer_at)
  END WHERE id = p_commission_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  RETURN latest_customer_at;
END $$;
REVOKE ALL ON FUNCTION public.mark_commission_owner_read(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_commission_owner_read(uuid,timestamptz) TO service_role;

CREATE TABLE IF NOT EXISTS public.quote_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  scope text NOT NULL CHECK (char_length(btrim(scope)) BETWEEN 10 AND 2000),
  terms text NOT NULL CHECK (char_length(btrim(terms)) BETWEEN 10 AND 2000),
  revision_allowance integer NOT NULL DEFAULT 1 CHECK (revision_allowance BETWEEN 0 AND 20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.quote_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quote_templates FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_quote_template_write() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
    VALUES ('owner', 'quote_template_delete', 'quote_template', OLD.id::text,
      jsonb_build_object('title', OLD.title));
    RETURN OLD;
  END IF;
  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
  VALUES ('owner', 'quote_template_' || lower(TG_OP), 'quote_template', NEW.id::text,
    jsonb_build_object('title', NEW.title));
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.audit_quote_template_write() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS quote_template_write_audit ON public.quote_templates;
CREATE TRIGGER quote_template_write_audit AFTER INSERT OR UPDATE OR DELETE ON public.quote_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_quote_template_write();
