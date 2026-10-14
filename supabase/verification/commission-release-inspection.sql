-- Read-only inspection. Run against a DISPOSABLE Supabase project after all migrations.
-- This is inventory evidence, not a substitute for executing role/access/concurrency tests.
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('commissions','commission_files','commission_events','notification_jobs',
    'payment_events','commission_refunds','quote_templates','artworks','exhibition_settings','audit_logs');
SELECT tablename, policyname, roles, cmd, qual, with_check FROM pg_policies
  WHERE schemaname IN ('public','storage') ORDER BY schemaname, tablename, policyname;
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
  WHERE id IN ('commission-private','artworks-public');
SELECT p.oid::regprocedure AS function, p.prosecdef AS security_definer, p.proconfig,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef ORDER BY 1;
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
  WHERE table_schema='public' AND table_name IN ('commission_files','commission_events',
    'notification_jobs','payment_events','commission_refunds','quote_templates','exhibition_settings')
  ORDER BY table_name, grantee, privilege_type;
-- Must return no rows: investigate any duplicate placement before attempting publication.
SELECT wall_identifier, count(*) FROM public.artworks WHERE publication_status <> 'archived'
  AND wall_identifier IN ('sanctuary-apex','entrance-west','main-west-1','main-west-2',
    'main-east-1','main-east-2','west-gallery-1','west-gallery-2','east-wing-1','east-wing-2')
GROUP BY wall_identifier HAVING count(*) > 1;
