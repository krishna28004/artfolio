-- Prepared remediation for review. NOT applied to the connected production project.
-- Production execution requires explicit owner approval and a reviewed grant snapshot.
-- Preserve the aggregate server API; raw visitor events are server-only.
BEGIN;
ALTER TABLE public.artwork_views ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public insert on artwork_views" ON public.artwork_views;
DROP POLICY IF EXISTS "Allow public select on artwork_views" ON public.artwork_views;
REVOKE ALL ON public.artwork_views FROM PUBLIC, anon, authenticated;
REVOKE ALL (id, artwork_id, ip_hash, viewed_at) ON public.artwork_views FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.artwork_views TO service_role;
DO $$
DECLARE sequence_name text;
BEGIN
  sequence_name := pg_get_serial_sequence('public.artwork_views','id');
  IF sequence_name IS NOT NULL THEN
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO service_role', sequence_name);
  END IF;
END $$;
COMMIT;
