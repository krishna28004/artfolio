-- Apply after 20261011000000_commission_reference_public_id.sql in an isolated project first.
-- All new customer data is server-only. No anon/authenticated table grants or storage policies.

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS request_reference text,
  ADD COLUMN IF NOT EXISTS tracking_token_hash text,
  ADD COLUMN IF NOT EXISTS tracking_nonce text,
  ADD COLUMN IF NOT EXISTS tracking_token_rotated_at timestamptz,
  ADD COLUMN IF NOT EXISTS reference_claim_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS accepted_quote_version integer,
  ADD COLUMN IF NOT EXISTS quote_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quote_scope text,
  ADD COLUMN IF NOT EXISTS quote_terms text,
  ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz,
  ADD COLUMN IF NOT EXISTS revision_allowance integer NOT NULL DEFAULT 0;

UPDATE public.commissions
SET request_reference = 'AF-' || upper(substr(replace(id::text, '-', ''), 1, 12))
WHERE request_reference IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS commissions_request_reference_key ON public.commissions(request_reference);

ALTER TABLE public.commissions DROP CONSTRAINT IF EXISTS commissions_status_check;
ALTER TABLE public.commissions ADD CONSTRAINT commissions_status_check CHECK (status IN (
  'pending', 'under_review', 'clarification_requested', 'quote_sent', 'quote_accepted',
  'approved', 'payment_pending', 'paid', 'in_progress', 'revision_requested',
  'ready_for_delivery', 'delivered', 'completed', 'fulfilled', 'rejected',
  'expired', 'cancelled'
));
ALTER TABLE public.commissions ADD CONSTRAINT commission_quote_version_check
  CHECK (quote_version >= 0 AND revision_allowance >= 0 AND
    (accepted_quote_version IS NULL OR accepted_quote_version <= quote_version));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('commission-private', 'commission-private', false, 26214400,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE TABLE public.commission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid REFERENCES public.commissions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('reference', 'deliverable')),
  storage_path text UNIQUE NOT NULL,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400),
  claim_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  accessed_at timestamptz,
  CONSTRAINT file_claim_state CHECK ((kind = 'reference' AND commission_id IS NULL AND claim_hash IS NOT NULL)
    OR (commission_id IS NOT NULL AND claim_hash IS NULL))
);
CREATE INDEX commission_files_commission_idx ON public.commission_files(commission_id, kind);
CREATE INDEX commission_files_stale_idx ON public.commission_files(created_at) WHERE commission_id IS NULL;
ALTER TABLE public.commission_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_files FROM anon, authenticated;

CREATE TABLE public.commission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  actor_type text NOT NULL CHECK (actor_type IN ('customer', 'owner', 'system', 'gateway')),
  event_type text NOT NULL,
  body text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commission_events_timeline_idx ON public.commission_events(commission_id, created_at, id);
ALTER TABLE public.commission_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_events FROM anon, authenticated;

CREATE TABLE public.notification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions(id) ON DELETE CASCADE,
  dedupe_key text UNIQUE NOT NULL,
  recipient text NOT NULL,
  template text NOT NULL,
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'sending', 'sent', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX notification_jobs_queue_idx ON public.notification_jobs(state, next_attempt_at);
ALTER TABLE public.notification_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_jobs FROM anon, authenticated;

CREATE TABLE public.payment_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  commission_id uuid REFERENCES public.commissions(id),
  payment_id text,
  amount bigint,
  currency text,
  state text NOT NULL DEFAULT 'received' CHECK (state IN ('received', 'processed', 'ignored', 'failed')),
  error_code text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX payment_events_recovery_idx ON public.payment_events(state, received_at);
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_events FROM anon, authenticated;

CREATE TABLE public.commission_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_id uuid NOT NULL REFERENCES public.commissions(id),
  razorpay_payment_id text NOT NULL,
  razorpay_refund_id text UNIQUE,
  amount bigint NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'initiated', 'processed', 'failed')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX commission_refunds_commission_idx ON public.commission_refunds(commission_id);
ALTER TABLE public.commission_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.commission_refunds FROM anon, authenticated;

-- A capture is recorded with its ledger row and commission transition in one DB transaction.
-- Gateway calls remain outside this transaction; webhook retries/reconciliation bridge failures.
CREATE OR REPLACE FUNCTION public.record_commission_capture(
  p_commission_id uuid, p_order_id text, p_payment_id text,
  p_amount bigint, p_currency text, p_method text DEFAULT NULL,
  p_event_id text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.commissions%ROWTYPE; existing_payment public.payments%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  IF p_order_id IS DISTINCT FROM c.razorpay_order_id OR
     p_amount IS DISTINCT FROM c.price OR p_currency IS DISTINCT FROM c.currency OR
     p_amount <= 0 OR p_currency <> 'INR' THEN
    RAISE EXCEPTION 'capture_mismatch';
  END IF;
  IF c.quote_version > 0 AND c.accepted_quote_version IS DISTINCT FROM c.quote_version THEN
    RAISE EXCEPTION 'quote_not_accepted';
  END IF;
  IF c.status IN ('paid','in_progress','revision_requested','ready_for_delivery',
                  'delivered','completed','fulfilled') THEN
    IF c.razorpay_payment_id IS DISTINCT FROM p_payment_id THEN
      RAISE EXCEPTION 'different_payment_already_recorded';
    END IF;
  ELSIF c.status NOT IN ('approved','quote_accepted','payment_pending','expired') THEN
    RAISE EXCEPTION 'invalid_capture_state';
  END IF;
  SELECT * INTO existing_payment FROM public.payments
    WHERE razorpay_payment_id = p_payment_id OR
      (razorpay_order_id = p_order_id AND status = 'created')
    ORDER BY (razorpay_payment_id = p_payment_id) DESC, created_at DESC
    LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    IF existing_payment.commission_id <> p_commission_id OR
       existing_payment.amount <> p_amount OR existing_payment.currency <> p_currency THEN
      RAISE EXCEPTION 'payment_record_mismatch';
    END IF;
    IF existing_payment.status <> 'refunded' THEN
      UPDATE public.payments SET razorpay_payment_id = p_payment_id,
        status = 'captured', method = COALESCE(p_method, method)
        WHERE id = existing_payment.id;
    END IF;
  ELSE
    INSERT INTO public.payments (commission_id, razorpay_order_id, razorpay_payment_id,
      amount, currency, status, method)
    VALUES (p_commission_id, p_order_id, p_payment_id, p_amount, p_currency, 'captured', p_method);
  END IF;
  IF c.status NOT IN ('paid','in_progress','revision_requested','ready_for_delivery',
                      'delivered','completed','fulfilled') THEN
    UPDATE public.commissions SET status = 'paid', razorpay_payment_id = p_payment_id,
      checkout_token_hash = NULL, paid_at = now(), updated_at = now()
      WHERE id = p_commission_id;
    INSERT INTO public.commission_events(commission_id, actor_type, event_type, metadata)
      VALUES (p_commission_id, 'gateway', 'payment_captured',
        jsonb_build_object('payment_id', p_payment_id, 'amount', p_amount, 'currency', p_currency));
  END IF;
  IF p_event_id IS NOT NULL THEN
    INSERT INTO public.payment_events(event_id, event_type, commission_id, payment_id,
      amount, currency, state, processed_at)
    VALUES (p_event_id, 'payment.captured', p_commission_id, p_payment_id,
      p_amount, p_currency, 'processed', now())
    ON CONFLICT(event_id) DO UPDATE SET state = 'processed', processed_at = now();
  END IF;
  RETURN 'captured';
END $$;
REVOKE ALL ON FUNCTION public.record_commission_capture(uuid,text,text,bigint,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_commission_capture(uuid,text,text,bigint,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.attach_commission_order(
  p_commission_id uuid, p_order_id text, p_amount bigint, p_currency text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.commissions%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  IF c.razorpay_order_id IS NOT NULL THEN RETURN c.razorpay_order_id; END IF;
  IF c.status NOT IN ('approved','payment_pending') OR c.price IS DISTINCT FROM p_amount OR
     c.currency IS DISTINCT FROM p_currency OR c.expires_at IS NULL OR c.expires_at <= now() OR
     (c.quote_version > 0 AND c.accepted_quote_version IS DISTINCT FROM c.quote_version) THEN
    RAISE EXCEPTION 'quote_not_payable';
  END IF;
  INSERT INTO public.payments(commission_id, razorpay_order_id, amount, currency, status)
    VALUES (p_commission_id, p_order_id, p_amount, p_currency, 'created');
  UPDATE public.commissions SET razorpay_order_id = p_order_id, status = 'payment_pending', updated_at = now()
    WHERE id = p_commission_id;
  RETURN p_order_id;
END $$;
REVOKE ALL ON FUNCTION public.attach_commission_order(uuid,text,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_commission_order(uuid,text,bigint,text) TO service_role;

CREATE OR REPLACE FUNCTION public.attach_commission_references(p_commission_id uuid, p_claims jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE item jsonb; attached integer := 0; file_id uuid; file_hash text;
BEGIN
  IF jsonb_typeof(p_claims) <> 'array' OR jsonb_array_length(p_claims) > 5 THEN
    RAISE EXCEPTION 'invalid_file_claims';
  END IF;
  PERFORM 1 FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_claims) LOOP
    file_id := (item->>'id')::uuid;
    file_hash := item->>'hash';
    UPDATE public.commission_files SET commission_id = p_commission_id, claim_hash = NULL
      WHERE id = file_id AND kind = 'reference' AND claim_hash = file_hash
        AND commission_id IS NULL AND created_at > now() - interval '24 hours';
    IF NOT FOUND THEN
      PERFORM 1 FROM public.commission_files WHERE id = file_id
        AND commission_id = p_commission_id AND kind = 'reference';
      IF NOT FOUND THEN RAISE EXCEPTION 'invalid_file_claim'; END IF;
    END IF;
    attached := attached + 1;
  END LOOP;
  RETURN attached;
END $$;
REVOKE ALL ON FUNCTION public.attach_commission_references(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_commission_references(uuid,jsonb) TO service_role;

-- Serialize refunds for one captured payment. Event acknowledgement, refund
-- ledger, payment status, and timeline commit together; late created events
-- cannot reverse a processed refund.
CREATE OR REPLACE FUNCTION public.record_commission_refund(
  p_event_id text, p_refund_id text, p_payment_id text,
  p_amount bigint, p_processed boolean
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payment_row public.payments%ROWTYPE; refund_row public.commission_refunds%ROWTYPE;
  total_refunded bigint; changed boolean := false; next_state text;
BEGIN
  SELECT * INTO payment_row FROM public.payments
    WHERE razorpay_payment_id = p_payment_id FOR UPDATE;
  IF NOT FOUND OR payment_row.status NOT IN ('captured','refunded') THEN
    RAISE EXCEPTION 'captured_payment_unavailable';
  END IF;
  IF p_amount <= 0 OR p_amount > payment_row.amount THEN
    RAISE EXCEPTION 'invalid_refund_amount';
  END IF;
  SELECT * INTO refund_row FROM public.commission_refunds
    WHERE razorpay_refund_id = p_refund_id FOR UPDATE;
  IF FOUND THEN
    IF refund_row.razorpay_payment_id <> p_payment_id OR refund_row.amount <> p_amount OR
       refund_row.commission_id <> payment_row.commission_id THEN
      RAISE EXCEPTION 'refund_record_mismatch';
    END IF;
    IF p_processed AND refund_row.status <> 'processed' THEN
      UPDATE public.commission_refunds SET status = 'processed', updated_at = now()
        WHERE id = refund_row.id;
      changed := true;
    END IF;
  ELSE
    next_state := CASE WHEN p_processed THEN 'processed' ELSE 'initiated' END;
    INSERT INTO public.commission_refunds(commission_id, razorpay_payment_id,
      razorpay_refund_id, amount, status)
    VALUES(payment_row.commission_id, p_payment_id, p_refund_id, p_amount, next_state);
    changed := true;
  END IF;
  SELECT coalesce(sum(amount), 0) INTO total_refunded FROM public.commission_refunds
    WHERE razorpay_payment_id = p_payment_id AND status = 'processed';
  IF total_refunded > payment_row.amount THEN RAISE EXCEPTION 'refund_total_exceeds_capture'; END IF;
  IF total_refunded = payment_row.amount AND payment_row.status <> 'refunded' THEN
    UPDATE public.payments SET status = 'refunded' WHERE id = payment_row.id;
  END IF;
  UPDATE public.payment_events SET commission_id = payment_row.commission_id,
    state = 'processed', processed_at = now() WHERE event_id = p_event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'refund_event_receipt_missing'; END IF;
  IF changed THEN
    INSERT INTO public.commission_events(commission_id, actor_type, event_type, metadata)
    VALUES(payment_row.commission_id, 'gateway',
      CASE WHEN p_processed THEN 'refund_processed' ELSE 'refund_initiated' END,
      jsonb_build_object('refund_id', p_refund_id, 'amount', p_amount));
  END IF;
  RETURN CASE WHEN total_refunded = payment_row.amount THEN 'fully_refunded'
    WHEN p_processed THEN 'partially_refunded' ELSE 'initiated' END;
END $$;
REVOKE ALL ON FUNCTION public.record_commission_refund(text,text,text,bigint,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_commission_refund(text,text,text,bigint,boolean) TO service_role;

-- Quote acceptance and its timeline entry must be indivisible: a customer
-- must never receive checkout access without a durable acceptance record.
CREATE OR REPLACE FUNCTION public.accept_commission_quote(
  p_commission_id uuid, p_quote_version integer, p_checkout_token_hash text,
  p_expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.commissions%ROWTYPE; new_event_id uuid;
BEGIN
  SELECT * INTO c FROM public.commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND OR c.status <> 'quote_sent' OR c.quote_version <> p_quote_version OR
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
  RETURN new_event_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_commission_quote(uuid,integer,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_commission_quote(uuid,integer,text,timestamptz) TO service_role;

CREATE OR REPLACE FUNCTION public.commission_business_metrics()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
WITH status_counts AS (
  SELECT count(*) AS inquiries,
    count(*) FILTER (WHERE status = 'pending') AS pending,
    count(*) FILTER (WHERE status IN ('approved','quote_accepted','payment_pending')) AS approved,
    count(*) FILTER (WHERE paid_at IS NOT NULL) AS paid,
    count(*) FILTER (WHERE status IN ('in_progress','revision_requested','ready_for_delivery')) AS in_progress,
    count(*) FILTER (WHERE status IN ('completed','fulfilled')) AS completed,
    count(*) FILTER (WHERE status = 'rejected') AS rejected,
    count(*) FILTER (WHERE status = 'cancelled') AS cancelled,
    count(*) FILTER (WHERE quote_version > 0) AS quoted,
    count(*) FILTER (WHERE accepted_quote_version IS NOT NULL) AS accepted
  FROM public.commissions
), revenue AS (
  SELECT coalesce(sum(amount),0) AS captured, count(*) AS captured_count
  FROM public.payments WHERE status IN ('captured','refunded')
), refunds AS (
  SELECT coalesce(sum(amount),0) AS refunded FROM public.commission_refunds WHERE status = 'processed'
), daily AS (
  SELECT date_trunc('day', c.paid_at)::date AS period, sum(p.amount) AS amount
  FROM public.payments p JOIN public.commissions c ON c.id = p.commission_id
  WHERE p.status IN ('captured','refunded') AND c.paid_at >= now() - interval '30 days'
  GROUP BY 1 ORDER BY 1
), popular AS (
  SELECT artwork_id, count(*) AS views FROM public.artwork_views
  GROUP BY artwork_id ORDER BY views DESC LIMIT 10
)
SELECT jsonb_build_object(
  'inquiries', s.inquiries, 'pending', s.pending, 'approved', s.approved,
  'paid', s.paid, 'in_progress', s.in_progress, 'completed', s.completed,
  'rejected', s.rejected, 'cancelled', s.cancelled,
  'quoted', s.quoted, 'accepted', s.accepted,
  'quote_acceptance_rate', CASE WHEN s.quoted > 0 THEN round(s.accepted::numeric / s.quoted,4) ELSE NULL END,
  'inquiry_to_payment_rate', CASE WHEN s.inquiries > 0 THEN round(s.paid::numeric / s.inquiries,4) ELSE NULL END,
  'captured_revenue_paise', r.captured, 'refund_total_paise', f.refunded,
  'net_revenue_paise', r.captured - f.refunded,
  'average_order_value_paise', CASE WHEN r.captured_count > 0 THEN round(r.captured::numeric / r.captured_count) ELSE NULL END,
  'daily_revenue', (SELECT coalesce(jsonb_agg(jsonb_build_object('period',period,'amount_paise',amount) ORDER BY period),'[]'::jsonb) FROM daily),
  'popular_artwork', (SELECT coalesce(jsonb_agg(jsonb_build_object('artwork_id',artwork_id,'views',views) ORDER BY views DESC),'[]'::jsonb) FROM popular)
) FROM status_counts s CROSS JOIN revenue r CROSS JOIN refunds f;
$$;
REVOKE ALL ON FUNCTION public.commission_business_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.commission_business_metrics() TO service_role;
