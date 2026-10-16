-- Forward-only hardening for pre-existing public tables outside the original
-- Artfolio migration inventory. Retain every row for private recovery review.
DO $$
DECLARE t text; cols text; seq text;
BEGIN
  FOREACH t IN ARRAY ARRAY['artworks_legacy_20260924',
    'commissions_legacy_20260924', 'users'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t AND c.relkind IN ('r','p')) THEN
      RAISE EXCEPTION 'legacy_object_is_not_a_table';
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS artfolio_legacy_private_records ON public.%I', t);
    EXECUTE format('CREATE POLICY artfolio_legacy_private_records ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING(false) WITH CHECK(false)', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    SELECT string_agg(quote_ident(attname), ',') INTO cols FROM pg_attribute
      WHERE attrelid=to_regclass('public.' || t) AND attnum>0 AND NOT attisdropped;
    IF cols IS NOT NULL THEN
      EXECUTE format('REVOKE ALL (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, t);
    END IF;
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON public.%I FROM service_role', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    seq := NULL;
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.' || t)
      AND attname='id' AND NOT attisdropped) THEN
      seq := pg_get_serial_sequence('public.' || t, 'id');
    END IF;
    IF seq IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', seq);
    END IF;
  END LOOP;
END $$;
