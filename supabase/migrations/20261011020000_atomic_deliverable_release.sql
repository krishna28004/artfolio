-- Commission state changes and their audit/timeline/outbox records commit atomically.
-- Apply after 20261011010000_private_commission_workflow.sql in an isolated project first.
CREATE OR REPLACE FUNCTION public.ensure_commission_submission_events(
  p_commission_id uuid,
  p_owner_recipient text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.commissions%ROWTYPE; new_event_id uuid;
BEGIN
  SELECT * INTO c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  SELECT id INTO new_event_id FROM public.commission_events
    WHERE commission_id = p_commission_id AND event_type = 'request_received'
    ORDER BY created_at LIMIT 1;
  IF new_event_id IS NULL THEN
    INSERT INTO public.commission_events(commission_id, actor_type, event_type, metadata)
      VALUES (p_commission_id, 'customer', 'request_received',
        jsonb_build_object('reference', c.request_reference))
      RETURNING id INTO new_event_id;
    INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
      VALUES ('customer', 'request_received', 'commission', p_commission_id::text,
        jsonb_build_object('reference', c.request_reference));
  END IF;
  INSERT INTO public.notification_jobs(commission_id, dedupe_key, recipient, template)
    VALUES (p_commission_id, new_event_id::text || ':customer', c.email, new_event_id::text || ':customer')
    ON CONFLICT (dedupe_key) DO NOTHING;
  IF p_owner_recipient IS NOT NULL THEN
    INSERT INTO public.notification_jobs(commission_id, dedupe_key, recipient, template)
      VALUES (p_commission_id, new_event_id::text || ':owner', p_owner_recipient, new_event_id::text || ':owner')
      ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN new_event_id;
END $$;

REVOKE ALL ON FUNCTION public.ensure_commission_submission_events(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_commission_submission_events(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.apply_commission_transition(
  p_commission_id uuid,
  p_expected_status text,
  p_quote_version integer,
  p_next_status text,
  p_action text,
  p_actor_type text,
  p_actor text,
  p_body text,
  p_metadata jsonb,
  p_changes jsonb DEFAULT '{}'::jsonb,
  p_notify_recipient text DEFAULT NULL,
  p_notify_audience text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.commissions%ROWTYPE;
  new_event_id uuid;
  revision_count integer;
BEGIN
  IF p_actor_type NOT IN ('customer', 'owner', 'system') THEN RAISE EXCEPTION 'invalid_actor'; END IF;
  SELECT * INTO c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  IF c.status IS DISTINCT FROM p_expected_status OR c.quote_version IS DISTINCT FROM p_quote_version THEN
    RAISE EXCEPTION 'commission_changed';
  END IF;
  IF p_action IN ('request_revision', 'revision_requested') THEN
    SELECT count(*) INTO revision_count FROM public.commission_events
      WHERE commission_id = p_commission_id AND event_type IN ('request_revision', 'revision_requested');
    IF revision_count >= c.revision_allowance THEN RAISE EXCEPTION 'revision_allowance_exhausted'; END IF;
  END IF;

  UPDATE public.commissions SET
    status = COALESCE(p_next_status, status),
    price = CASE WHEN p_changes ? 'price' THEN NULLIF(p_changes->>'price', '')::bigint ELSE price END,
    quote_scope = CASE WHEN p_changes ? 'quote_scope' THEN p_changes->>'quote_scope' ELSE quote_scope END,
    quote_terms = CASE WHEN p_changes ? 'quote_terms' THEN p_changes->>'quote_terms' ELSE quote_terms END,
    estimated_delivery_at = CASE WHEN p_changes ? 'estimated_delivery_at' THEN NULLIF(p_changes->>'estimated_delivery_at', '')::timestamptz ELSE estimated_delivery_at END,
    revision_allowance = CASE WHEN p_changes ? 'revision_allowance' THEN (p_changes->>'revision_allowance')::integer ELSE revision_allowance END,
    admin_notes = CASE WHEN p_changes ? 'admin_notes' THEN p_changes->>'admin_notes' ELSE admin_notes END,
    accepted_quote_version = CASE WHEN p_changes ? 'accepted_quote_version' THEN NULLIF(p_changes->>'accepted_quote_version', '')::integer ELSE accepted_quote_version END,
    checkout_token_hash = CASE WHEN p_changes ? 'checkout_token_hash' THEN p_changes->>'checkout_token_hash' ELSE checkout_token_hash END,
    expires_at = CASE WHEN p_changes ? 'expires_at' THEN NULLIF(p_changes->>'expires_at', '')::timestamptz ELSE expires_at END,
    razorpay_order_id = CASE WHEN p_changes ? 'razorpay_order_id' THEN p_changes->>'razorpay_order_id' ELSE razorpay_order_id END,
    tracking_nonce = CASE WHEN p_changes ? 'tracking_nonce' THEN p_changes->>'tracking_nonce' ELSE tracking_nonce END,
    tracking_token_hash = CASE WHEN p_changes ? 'tracking_token_hash' THEN p_changes->>'tracking_token_hash' ELSE tracking_token_hash END,
    tracking_token_rotated_at = CASE WHEN p_changes ? 'tracking_token_rotated_at' THEN NULLIF(p_changes->>'tracking_token_rotated_at', '')::timestamptz ELSE tracking_token_rotated_at END,
    quote_version = CASE WHEN p_changes ? 'quote_version' THEN (p_changes->>'quote_version')::integer ELSE quote_version END,
    updated_at = now()
  WHERE id = p_commission_id;

  INSERT INTO public.commission_events(commission_id, actor_type, event_type, body, metadata)
    VALUES (p_commission_id, p_actor_type, p_action, p_body, COALESCE(p_metadata, '{}'::jsonb))
    RETURNING id INTO new_event_id;
  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
    VALUES (p_actor, p_action, 'commission', p_commission_id::text,
      jsonb_build_object('event_id', new_event_id));
  IF p_notify_recipient IS NOT NULL AND p_notify_audience IN ('customer', 'owner') THEN
    INSERT INTO public.notification_jobs(commission_id, dedupe_key, recipient, template)
      VALUES (p_commission_id, new_event_id::text || ':' || p_notify_audience,
        p_notify_recipient, new_event_id::text || ':' || p_notify_audience)
      ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN new_event_id;
END $$;

REVOKE ALL ON FUNCTION public.apply_commission_transition(uuid,text,integer,text,text,text,text,text,jsonb,jsonb,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_commission_transition(uuid,text,integer,text,text,text,text,text,jsonb,jsonb,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.accept_commission_quote_with_notice(
  p_commission_id uuid,
  p_quote_version integer,
  p_checkout_token_hash text,
  p_expires_at timestamptz,
  p_owner_recipient text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.commissions%ROWTYPE; new_event_id uuid;
BEGIN
  SELECT * INTO c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND OR p_quote_version IS NULL OR p_checkout_token_hash IS NULL OR p_expires_at IS NULL OR
     c.status <> 'quote_sent' OR c.quote_version <> p_quote_version OR
     c.quote_version < 1 OR c.price IS NULL OR c.price <= 0 OR
     c.quote_scope IS NULL OR c.quote_terms IS NULL OR
     p_checkout_token_hash !~ '^[0-9a-f]{64}$' OR
     p_expires_at <= now() OR p_expires_at > now() + interval '25 hours' THEN
    RAISE EXCEPTION 'quote_not_acceptable';
  END IF;
  UPDATE public.commissions SET status = 'approved',
    accepted_quote_version = p_quote_version, checkout_token_hash = p_checkout_token_hash,
    expires_at = p_expires_at, updated_at = now() WHERE id = p_commission_id;
  INSERT INTO public.commission_events(commission_id, actor_type, event_type, metadata)
    VALUES(p_commission_id, 'customer', 'accept_quote',
      jsonb_build_object('quote_version', p_quote_version, 'price', c.price))
    RETURNING id INTO new_event_id;
  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
    VALUES ('customer', 'accept_quote', 'commission', p_commission_id::text,
      jsonb_build_object('event_id', new_event_id, 'quote_version', p_quote_version));
  IF p_owner_recipient IS NOT NULL THEN
    INSERT INTO public.notification_jobs(commission_id, dedupe_key, recipient, template)
      VALUES (p_commission_id, new_event_id::text || ':owner', p_owner_recipient, new_event_id::text || ':owner')
      ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN new_event_id;
END $$;

REVOKE ALL ON FUNCTION public.accept_commission_quote_with_notice(uuid,integer,text,timestamptz,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_commission_quote_with_notice(uuid,integer,text,timestamptz,text) TO service_role;

CREATE OR REPLACE FUNCTION public.release_commission_deliverables(
  p_commission_id uuid,
  p_actor text,
  p_body text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.commissions%ROWTYPE;
  released_count integer;
  new_event_id uuid;
BEGIN
  SELECT * INTO c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  IF c.status <> 'ready_for_delivery' THEN RAISE EXCEPTION 'commission_not_ready'; END IF;

  UPDATE public.commission_files SET delivered_at = now()
    WHERE commission_id = p_commission_id AND kind = 'deliverable' AND delivered_at IS NULL;
  GET DIAGNOSTICS released_count = ROW_COUNT;
  IF released_count = 0 THEN RAISE EXCEPTION 'no_pending_deliverables'; END IF;

  UPDATE public.commissions SET status = 'delivered', updated_at = now()
    WHERE id = p_commission_id;
  INSERT INTO public.commission_events(commission_id, actor_type, event_type, body, metadata)
    VALUES (p_commission_id, 'owner', 'deliver', p_body,
      jsonb_build_object('released_file_count', released_count))
    RETURNING id INTO new_event_id;
  INSERT INTO public.audit_logs(actor, action, target_type, target_id, metadata)
    VALUES (p_actor, 'deliver', 'commission', p_commission_id::text,
      jsonb_build_object('event_id', new_event_id, 'released_file_count', released_count));
  IF c.email IS NOT NULL THEN
    INSERT INTO public.notification_jobs(commission_id, dedupe_key, recipient, template)
      VALUES (p_commission_id, new_event_id::text || ':customer', c.email, new_event_id::text || ':customer')
      ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN new_event_id;
END $$;

REVOKE ALL ON FUNCTION public.release_commission_deliverables(uuid,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_commission_deliverables(uuid,text,text) TO service_role;

-- Payment and completed-refund notifications are inserted inside the same
-- transaction that records the gateway event and timeline entry.
CREATE OR REPLACE FUNCTION public.queue_commission_payment_notice()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient_email text;
BEGIN
  IF NEW.event_type NOT IN ('payment_captured', 'refund_processed') THEN RETURN NEW; END IF;
  SELECT email INTO recipient_email FROM public.commissions WHERE id = NEW.commission_id;
  IF recipient_email IS NOT NULL THEN
    INSERT INTO public.notification_jobs(commission_id, dedupe_key, recipient, template)
      VALUES (NEW.commission_id, NEW.id::text || ':customer', recipient_email, NEW.id::text || ':customer')
      ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.queue_commission_payment_notice() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER commission_payment_notification_outbox
  AFTER INSERT ON public.commission_events
  FOR EACH ROW EXECUTE FUNCTION public.queue_commission_payment_notice();
