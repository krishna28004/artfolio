-- Read-only baseline inventory. Run before planning any production migration.
-- No customer identities, tokens or file paths are selected.
BEGIN TRANSACTION READ ONLY;
SELECT to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS migration_history_available;
DO $$
DECLARE versions text;
BEGIN
 IF to_regclass('supabase_migrations.schema_migrations') IS NOT NULL THEN
  EXECUTE 'SELECT string_agg(version::text, '', '' ORDER BY version) FROM supabase_migrations.schema_migrations' INTO versions;
  RAISE NOTICE 'Recorded migration versions: %', coalesce(versions, '(none)');
 END IF;
END $$;
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets
 WHERE id IN ('commission-private', 'artworks-public');
SELECT column_name,data_type FROM information_schema.columns
 WHERE table_schema='auth' AND table_name='sessions' AND column_name IN ('id','user_id','not_after');
SELECT table_name,column_name,data_type FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('artworks','commissions','commission_files',
 'commission_events','notification_jobs','payment_events','commission_refunds','quote_templates','exhibition_settings','artwork_views')
 ORDER BY table_name,ordinal_position;
SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname;
SELECT c.relname,k.conname,pg_get_constraintdef(k.oid) FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
 JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,k.conname;
SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
 WHERE schemaname IN ('public','storage') ORDER BY schemaname,tablename,policyname;
SELECT table_name,grantee,privilege_type FROM information_schema.role_table_grants
 WHERE table_schema='public' ORDER BY table_name,grantee,privilege_type;
SELECT table_name,column_name,grantee,privilege_type FROM information_schema.role_column_grants
 WHERE table_schema='public' AND table_name='artwork_views';
SELECT p.oid::regprocedure,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prosecdef;
DO $$
DECLARE groups bigint;
BEGIN
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commissions' AND column_name='request_reference') THEN
  EXECUTE 'SELECT count(*) FROM (SELECT request_reference FROM public.commissions WHERE request_reference IS NOT NULL GROUP BY request_reference HAVING count(*)>1) duplicate_groups' INTO groups;
  RAISE NOTICE 'Duplicate request-reference groups: %', groups;
 END IF;
 IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='artworks' AND column_name='wall_identifier') THEN
  EXECUTE 'SELECT count(*) FROM (SELECT wall_identifier FROM public.artworks WHERE wall_identifier IN (''sanctuary-apex'',''entrance-west'',''main-west-1'',''main-west-2'',''main-east-1'',''main-east-2'',''west-gallery-1'',''west-gallery-2'',''east-wing-1'',''east-wing-2'') GROUP BY wall_identifier HAVING count(*)>1) duplicate_groups' INTO groups;
  RAISE NOTICE 'Duplicate museum-slot groups before publication constraints: %', groups;
 END IF;
END $$;
COMMIT;
