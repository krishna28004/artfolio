-- Forward hardening. LOCAL REHEARSAL ONLY; no remote execution authorized.
-- Apply after the ten reviewed migrations. Keep bootstrap migrations inside one
-- fresh-project transaction so their intermediate permissive policies are never exposed.
ALTER TABLE public.payment_events ADD COLUMN IF NOT EXISTS provider_event_id text;
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
CREATE SCHEMA IF NOT EXISTS artfolio_private;
REVOKE ALL ON SCHEMA artfolio_private FROM PUBLIC, anon, authenticated, service_role;

-- RLS plus both table and column privileges: permissive legacy policies cannot
-- turn these private tables into customer-facing endpoints.
DO $$
DECLARE t text; cols text; seq text;
BEGIN
 FOREACH t IN ARRAY ARRAY['commissions','payments','audit_logs','commission_files',
  'commission_events','notification_jobs','payment_events','commission_refunds',
  'quote_templates','exhibition_settings','artwork_views'] LOOP
  IF to_regclass('public.' || t) IS NULL THEN RAISE EXCEPTION 'required_private_table_missing'; END IF;
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS artfolio_private_records_server_only ON public.%I',t);
  EXECUTE format('CREATE POLICY artfolio_private_records_server_only ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false)',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
  SELECT string_agg(quote_ident(attname), ',') INTO cols FROM pg_attribute
   WHERE attrelid=to_regclass('public.'||t) AND attnum>0 AND NOT attisdropped;
  EXECUTE format('REVOKE ALL (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO service_role', t);
  seq := NULL;
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.'||t) AND attname='id' AND NOT attisdropped) THEN
   seq := pg_get_serial_sequence('public.'||t,'id');
  END IF;
  IF seq IS NOT NULL THEN
   EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq);
   EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', seq);
  END IF;
 END LOOP;
END $$;
-- Audit/financial history is append/update through the server; no client grant.
REVOKE UPDATE, DELETE ON public.audit_logs FROM service_role;
REVOKE DELETE ON public.payments, public.payment_events, public.commission_refunds FROM service_role;

ALTER TABLE public.artworks ALTER COLUMN publication_status SET DEFAULT 'draft';
REVOKE ALL ON public.artworks FROM PUBLIC, anon, authenticated;
DO $$
DECLARE cols text;
BEGIN
 SELECT string_agg(quote_ident(attname), ',') INTO cols FROM pg_attribute
  WHERE attrelid='public.artworks'::regclass AND attnum>0 AND NOT attisdropped;
 EXECUTE format('REVOKE ALL (%s) ON public.artworks FROM PUBLIC, anon, authenticated',cols);
END $$;
GRANT SELECT (id,title,artist,year,description,image_url,thumbnail_url,texture_url,
 medium,dimensions,price,category,is_available,is_featured,display_order,
 position_3d,rotation_3d,wall_identifier,created_at,updated_at,
 publication_status,sale_status,image_urls) ON public.artworks TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artworks TO service_role;
DROP POLICY IF EXISTS "Artfolio published rows only" ON public.artworks;
CREATE POLICY "Artfolio published rows only" ON public.artworks AS RESTRICTIVE
 FOR SELECT TO anon, authenticated USING (publication_status='published');

-- A restrictive policy protects private buckets even if an unrelated broad
-- permissive storage policy is installed. Public-bucket downloads remain public:
-- do not store drafts or private original files there.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 VALUES('artworks-private','artworks-private',false,12582912,ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false;
UPDATE storage.buckets SET public=false WHERE id='commission-private';
DROP POLICY IF EXISTS "Artfolio private buckets server only" ON storage.objects;
CREATE POLICY "Artfolio private buckets server only" ON storage.objects AS RESTRICTIVE
 FOR ALL TO anon, authenticated
 USING (bucket_id NOT IN ('commission-private','artworks-private'))
 WITH CHECK (bucket_id NOT IN ('commission-private','artworks-private'));

-- Preserve implementations in a schema inaccessible to API roles. Public
-- wrappers validate their contracts before invoking the atomic transaction.
DO $$
DECLARE signature text;
BEGIN
 FOREACH signature IN ARRAY ARRAY[
 'apply_commission_transition(uuid,text,integer,text,text,text,text,text,jsonb,jsonb,text,text)',
 'accept_commission_quote(uuid,integer,text,timestamptz)',
 'accept_commission_quote_with_notice(uuid,integer,text,timestamptz,text)',
 'attach_commission_order(uuid,text,bigint,text)',
 'attach_commission_references(uuid,jsonb)',
 'record_commission_capture(uuid,text,text,bigint,text,text,text)',
 'record_commission_refund(text,text,text,bigint,boolean)',
 'release_commission_deliverables(uuid,text,text)'] LOOP
  IF to_regprocedure('artfolio_private.'||signature) IS NULL THEN
   EXECUTE 'ALTER FUNCTION public.'||signature||' SET SCHEMA artfolio_private';
  END IF;
  EXECUTE 'ALTER FUNCTION artfolio_private.'||signature||' SET search_path = ''''';
  EXECUTE 'REVOKE ALL ON FUNCTION artfolio_private.'||signature||' FROM PUBLIC, anon, authenticated, service_role';
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.apply_commission_transition(
 p_commission_id uuid,p_expected_status text,p_quote_version integer,p_next_status text,
 p_action text,p_actor_type text,p_actor text,p_body text,p_metadata jsonb,
 p_changes jsonb DEFAULT '{}'::jsonb,p_notify_recipient text DEFAULT NULL,p_notify_audience text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.commissions%ROWTYPE; legal boolean:=false; allowed text[]:='{}'; k text;
BEGIN
 IF p_actor_type IS NULL OR p_actor_type NOT IN ('owner','customer','system') OR
  p_actor IS NULL OR btrim(p_actor)='' OR length(p_actor)>254 OR
  p_action IS NULL OR p_expected_status IS NULL OR p_quote_version IS NULL OR
  p_changes IS NULL OR jsonb_typeof(p_changes)<>'object' OR
  (p_metadata IS NOT NULL AND jsonb_typeof(p_metadata)<>'object') OR length(p_body)>2000 THEN
  RAISE EXCEPTION 'invalid_transition_arguments';
 END IF;
 SELECT * INTO c FROM public.commissions WHERE id=p_commission_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
 IF c.status IS DISTINCT FROM p_expected_status OR c.quote_version IS DISTINCT FROM p_quote_version THEN
  RAISE EXCEPTION 'commission_changed';
 END IF;
 IF p_actor_type='owner' THEN
  legal:=CASE p_action
   WHEN 'quote_sent' THEN c.status IN ('pending','under_review','clarification_requested','quote_sent') AND p_next_status='quote_sent'
   WHEN 'start' THEN c.status='paid' AND p_next_status='in_progress'
   WHEN 'resolve_revision' THEN c.status='revision_requested' AND p_next_status='in_progress'
   WHEN 'ready' THEN c.status='in_progress' AND p_next_status='ready_for_delivery'
   WHEN 'cancel' THEN c.status IN ('pending','under_review','clarification_requested','quote_sent','approved','expired') AND p_next_status='cancelled'
   WHEN 'reject' THEN c.status IN ('pending','under_review','clarification_requested','quote_sent') AND p_next_status='rejected'
   WHEN 'reply' THEN p_next_status IS NULL
   WHEN 'progress' THEN c.status='in_progress' AND p_next_status IS NULL
   WHEN 'rotate_token' THEN p_next_status IS NULL ELSE false END;
  IF p_action='quote_sent' THEN
   allowed:=ARRAY['price','quote_scope','quote_terms','estimated_delivery_at','revision_allowance','admin_notes',
    'quote_version','accepted_quote_version','checkout_token_hash','razorpay_order_id','expires_at'];
   IF (p_changes->>'price')::bigint IS NULL OR (p_changes->>'price')::bigint<=0 OR
    length(btrim(p_changes->>'quote_scope'))<10 OR length(btrim(p_changes->>'quote_terms'))<10 OR
    p_changes->>'quote_scope' IS NULL OR p_changes->>'quote_terms' IS NULL OR
    (p_changes->>'quote_version')::integer IS DISTINCT FROM c.quote_version+1 OR
    (p_changes->>'revision_allowance')::integer IS NULL OR (p_changes->>'revision_allowance')::integer NOT BETWEEN 0 AND 20 OR
    (p_changes->>'expires_at')::timestamptz IS NULL OR (p_changes->>'expires_at')::timestamptz<=now() OR
    p_changes->>'accepted_quote_version' IS NOT NULL OR p_changes->>'checkout_token_hash' IS NOT NULL OR
    p_changes->>'razorpay_order_id' IS NOT NULL THEN RAISE EXCEPTION 'invalid_quote'; END IF;
  ELSIF p_action='rotate_token' THEN
   allowed:=ARRAY['tracking_nonce','tracking_token_hash','tracking_token_rotated_at'];
   IF p_changes->>'tracking_token_hash' IS NULL OR p_changes->>'tracking_token_hash' !~ '^[0-9a-f]{64}$'
    OR length(p_changes->>'tracking_nonce')<32 OR p_changes->>'tracking_nonce' IS NULL THEN RAISE EXCEPTION 'invalid_tracking_rotation'; END IF;
  ELSIF p_action IN ('cancel','reject') THEN allowed:=ARRAY['checkout_token_hash']; END IF;
 ELSIF p_actor_type='customer' THEN
  legal:=CASE p_action
   WHEN 'decline_quote' THEN c.status='quote_sent' AND p_next_status='cancelled'
   WHEN 'request_clarification' THEN c.status='quote_sent' AND p_next_status='clarification_requested'
   WHEN 'revision_requested' THEN c.status IN ('in_progress','delivered') AND p_next_status='revision_requested'
   WHEN 'delivery_issue' THEN c.status='delivered' AND p_next_status='revision_requested'
   WHEN 'complete' THEN c.status='delivered' AND p_next_status='completed'
   WHEN 'message' THEN c.status NOT IN ('rejected','cancelled','completed','fulfilled','expired') AND p_next_status IS NULL
   WHEN 'request_refund' THEN c.status IN ('paid','in_progress','revision_requested','ready_for_delivery','delivered') AND p_next_status IS NULL
   ELSE false END;
 ELSIF p_actor_type='system' THEN
  legal:=p_action='expire' AND c.status IN ('approved','payment_pending') AND p_next_status='expired' AND c.expires_at<=now();
 END IF;
 IF legal IS DISTINCT FROM true THEN RAISE EXCEPTION 'invalid_state_transition'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_changes) LOOP
  IF NOT k=ANY(allowed) THEN RAISE EXCEPTION 'unauthorized_transition_field'; END IF;
 END LOOP;
 IF p_actor_type='customer' AND p_action IN ('message','request_clarification','revision_requested','delivery_issue','request_refund')
  AND (p_body IS NULL OR length(btrim(p_body))<3) THEN RAISE EXCEPTION 'message_required'; END IF;
 IF p_notify_recipient IS NOT NULL AND (
  p_notify_audience IS NULL OR p_notify_audience NOT IN ('customer','owner') OR
  p_notify_recipient !~ '^[^[:space:],;<>@]+@[^[:space:],;<>@]+\.[^[:space:],;<>@]+$' OR length(p_notify_recipient)>254 OR
  (p_notify_audience='customer' AND lower(p_notify_recipient)<>lower(c.email))
 ) THEN RAISE EXCEPTION 'invalid_notification_recipient'; END IF;
 RETURN artfolio_private.apply_commission_transition(p_commission_id,p_expected_status,p_quote_version,p_next_status,
  p_action,p_actor_type,p_actor,p_body,p_metadata,p_changes,p_notify_recipient,p_notify_audience);
END $$;

CREATE OR REPLACE FUNCTION public.accept_commission_quote(
 p_commission_id uuid,p_quote_version integer,p_checkout_token_hash text,p_expires_at timestamptz
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.commissions%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.commissions WHERE id=p_commission_id FOR UPDATE;
 IF NOT FOUND OR c.expires_at IS NULL OR c.expires_at<=now() THEN RAISE EXCEPTION 'quote_expired'; END IF;
 RETURN artfolio_private.accept_commission_quote(p_commission_id,p_quote_version,p_checkout_token_hash,p_expires_at);
END $$;
CREATE OR REPLACE FUNCTION public.accept_commission_quote_with_notice(
 p_commission_id uuid,p_quote_version integer,p_checkout_token_hash text,p_expires_at timestamptz,p_owner_recipient text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.commissions%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.commissions WHERE id=p_commission_id FOR UPDATE;
 IF NOT FOUND OR c.expires_at IS NULL OR c.expires_at<=now() THEN RAISE EXCEPTION 'quote_expired'; END IF;
 IF p_owner_recipient IS NOT NULL AND (length(p_owner_recipient)>254 OR
  p_owner_recipient !~ '^[^[:space:],;<>@]+@[^[:space:],;<>@]+\.[^[:space:],;<>@]+$') THEN RAISE EXCEPTION 'invalid_notification_recipient'; END IF;
 RETURN artfolio_private.accept_commission_quote_with_notice(p_commission_id,p_quote_version,p_checkout_token_hash,p_expires_at,p_owner_recipient);
END $$;
CREATE OR REPLACE FUNCTION public.attach_commission_order(p_commission_id uuid,p_order_id text,p_amount bigint,p_currency text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE c public.commissions%ROWTYPE;
BEGIN
 SELECT * INTO c FROM public.commissions WHERE id=p_commission_id FOR UPDATE;
 IF NOT FOUND OR p_order_id IS NULL OR btrim(p_order_id)='' OR length(p_order_id)>200 OR p_amount IS NULL OR
  p_amount<=0 OR p_currency IS DISTINCT FROM 'INR' OR c.price IS DISTINCT FROM p_amount OR
  c.currency IS DISTINCT FROM p_currency OR (c.quote_version>0 AND c.accepted_quote_version IS DISTINCT FROM c.quote_version) OR c.status NOT IN ('approved','payment_pending') OR c.expires_at IS NULL OR c.expires_at<=now() THEN
  RAISE EXCEPTION 'quote_not_payable';
 END IF;
 RETURN artfolio_private.attach_commission_order(p_commission_id,p_order_id,p_amount,p_currency);
END $$;
CREATE OR REPLACE FUNCTION public.attach_commission_references(p_commission_id uuid,p_claims jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE item jsonb;
BEGIN
 IF p_claims IS NULL OR jsonb_typeof(p_claims)<>'array' OR jsonb_array_length(p_claims)>5 THEN RAISE EXCEPTION 'invalid_file_claims'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_claims) LOOP
  IF item->>'id' IS NULL OR item->>'hash' IS NULL OR item->>'hash' !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'invalid_file_claim'; END IF;
 END LOOP;
 RETURN artfolio_private.attach_commission_references(p_commission_id,p_claims);
END $$;
CREATE OR REPLACE FUNCTION public.record_commission_capture(
 p_commission_id uuid,p_order_id text,p_payment_id text,p_amount bigint,p_currency text,p_method text DEFAULT NULL,p_event_id text DEFAULT NULL
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_order_id IS NULL OR btrim(p_order_id)='' OR p_payment_id IS NULL OR btrim(p_payment_id)='' OR
  p_amount IS NULL OR p_amount<=0 OR p_currency IS DISTINCT FROM 'INR' THEN RAISE EXCEPTION 'capture_mismatch'; END IF;
 RETURN artfolio_private.record_commission_capture(p_commission_id,p_order_id,p_payment_id,p_amount,p_currency,p_method,p_event_id);
END $$;
CREATE OR REPLACE FUNCTION public.record_commission_refund(p_event_id text,p_refund_id text,p_payment_id text,p_amount bigint,p_processed boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_event_id IS NULL OR btrim(p_event_id)='' OR p_refund_id IS NULL OR btrim(p_refund_id)='' OR
  p_payment_id IS NULL OR btrim(p_payment_id)='' OR p_amount IS NULL OR p_amount<=0 OR p_processed IS NULL THEN
  RAISE EXCEPTION 'invalid_refund_arguments';
 END IF;
 RETURN artfolio_private.record_commission_refund(p_event_id,p_refund_id,p_payment_id,p_amount,p_processed);
END $$;
CREATE OR REPLACE FUNCTION public.release_commission_deliverables(p_commission_id uuid,p_actor text,p_body text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF p_actor IS NULL OR btrim(p_actor)='' OR length(p_actor)>254 OR length(p_body)>2000 THEN RAISE EXCEPTION 'invalid_delivery_arguments'; END IF;
 PERFORM 1 FROM public.commissions WHERE id=p_commission_id FOR UPDATE;
 PERFORM 1 FROM public.payments WHERE commission_id=p_commission_id ORDER BY id FOR SHARE;
 IF EXISTS (SELECT 1 FROM public.payments WHERE commission_id=p_commission_id AND status='refunded') THEN
  RAISE EXCEPTION 'fully_refunded_delivery_blocked';
 END IF;
 RETURN artfolio_private.release_commission_deliverables(p_commission_id,p_actor,p_body);
END $$;

-- Harden only Artfolio functions; do not alter unrelated extension/RPC functions.
DO $$
DECLARE f record;
BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature,p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname IN (
   'record_commission_capture','attach_commission_order','attach_commission_references','record_commission_refund',
   'accept_commission_quote','accept_commission_quote_with_notice','apply_commission_transition',
   'release_commission_deliverables','ensure_commission_submission_events','queue_commission_payment_notice',
   'set_exhibition_publication','audit_artwork_write','commission_business_metrics','commission_unread_counts',
   'mark_commission_owner_read','audit_quote_template_write','is_owner_session_active')
 LOOP
  EXECUTE format('ALTER FUNCTION %s SET search_path = ''''',f.signature);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',f.signature);
  IF f.proname NOT IN ('queue_commission_payment_notice','audit_artwork_write','audit_quote_template_write') THEN
   EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature);
  END IF;
 END LOOP;
END $$;