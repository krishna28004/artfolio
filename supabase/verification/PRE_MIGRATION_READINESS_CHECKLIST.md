# Artfolio rehearsal: pre-migration readiness checklist

**Historical pre-application checklist, updated 16 October 2026.** The rehearsal and approved production migration sets have already been applied. Do not run the old bundle against either existing project. Use this checklist only as a reference when a separately reviewed future database operation requires a fresh inventory. Production still has only four recorded CLI migration versions because SQL Editor was used; keep the execution ledger and reconcile that history before any CLI deployment. The production snapshot is partial and has no tested restore path. Keep commissions and payments disabled. This document does not authorize SQL Editor use. The capture and restore limitations are recorded in [`docs/supabase/RECOVERY_WORKFLOW.md`](../../docs/supabase/RECOVERY_WORKFLOW.md).

## What the existing inventory does not establish

- Project ownership, exact project reference, selected branch, or why the branch is labelled `PRODUCTION`. Those are Dashboard checks, not SQL in this repository.
- Whether the recorded migration versions correspond to the **current bytes** of all 15 files, whether a prior SQL Editor application went unrecorded, or whether the database is partly installed. The fresh-project bundle guard checks only for public ordinary/partitioned tables, not migration history, views, functions, buckets, or Storage objects.
- Complete privilege state: schema, sequence, default and inherited/effective grants; column grants beyond `artwork_views`; and all functions (including non-`SECURITY DEFINER` functions and `artfolio_private`). `information_schema` grant views can be limited by the inspection role.
- RLS state on Storage tables, policy `permissive` mode, effective API-role access, function ownership, and the SQL execution role's ability to create policies on `storage.objects`.
- Auth column **types**, including `auth.sessions.created_at`, `auth.users`/MFA schema presence, and the execution role's `SELECT` privilege on `auth.sessions`.
- Required Storage column types and privileges; the `artworks-private` bucket; object counts in all three buckets; and whether an existing `artworks-public` bucket contains objects that would become public.
- Existing artwork publication/sale distribution, active and draft museum-slot collisions, and whether legacy rows would be changed by the backfills. The existing duplicate notices do not cover draft slots or publication-aware active slots.
- A recoverable backup and a documented, tested restore path. SQL metadata alone cannot prove either.

## Gate A — target identity and rollback evidence (Dashboard/manual)

- [ ] In the Supabase project list, select **artfolio-rehearsal**. Privately compare its displayed reference with the ignored test configuration; confirm it differs from the main project. Record the selected branch and explain its `PRODUCTION` label. A URL/reference syntax match is not proof of ownership.
- [ ] Confirm there are no real users, customer records, provider integrations, or Storage objects that depend on this project. Record who owns the decision to treat the selected branch as disposable.
- [ ] Identify the database backup and Storage metadata/object backup, their retention and location, and who can restore them. Record a recent restore drill into a separate disposable target, its result, and the recovery time. **BLOCKED** if a restore path has not been tested.
- [ ] Keep `ARTFOLIO_COMMISSIONS_ENABLED=false` and `ARTFOLIO_PAYMENTS_ENABLED=false`. Do not place production credentials in a rehearsal execution environment.

## Gate B — read-only database inventory (only after separate authorization)

Run the existing `pre-migration-inventory.sql` only against the exact confirmed rehearsal project. Use a separate read-only transaction for each supplemental query below. Stop on an unexpected object, missing schema/column, insufficient permission, or nonempty application table/bucket. These queries return names, ACL metadata, or counts; they do not select customer rows, tokens, object paths, or artwork content.

First check existence and the SQL role. SQL cannot independently prove the Dashboard project reference or branch.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT current_user AS execution_role,
  to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AS history_exists,
  to_regclass('auth.users') IS NOT NULL AS auth_users_exists,
  to_regclass('auth.sessions') IS NOT NULL AS auth_sessions_exists,
  to_regclass('auth.mfa_factors') IS NOT NULL AS auth_mfa_factors_exists,
  to_regclass('storage.buckets') IS NOT NULL AS storage_buckets_exists,
  to_regclass('storage.objects') IS NOT NULL AS storage_objects_exists;
SELECT n.nspname, c.relname, c.relkind, pg_get_userbyid(c.relowner) AS owner_role
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'artfolio_private')
  AND c.relkind IN ('r','p','v','m','f','S')
ORDER BY n.nspname, c.relkind, c.relname;
COMMIT;
```

If migration history exists, the existing inventory prints recorded **version numbers**. Compare every version privately with the 15-file manifest and the actual schema. A recorded version does not prove its SQL bytes match today's edited historical file. If public application tables, relevant views/functions, or unexpected history exist, **do not use the fresh-project bundle**; prepare a reviewed forward-only reconciliation instead.

Inspect complete explicit ACLs and effective privileges for `anon`, `authenticated`, and `service_role`, including inherited roles. A null ACL means PostgreSQL defaults, not proof of denial. Review every unexpected grant before execution.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT n.nspname, n.nspacl::text AS schema_acl
FROM pg_namespace n WHERE n.nspname IN ('public','storage','artfolio_private');
SELECT n.nspname, c.relname, c.relkind,
  pg_get_userbyid(c.relowner) AS owner_role, c.relacl::text AS relation_acl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','storage','artfolio_private')
  AND c.relkind IN ('r','p','v','m','f','S')
ORDER BY n.nspname,c.relname;
SELECT n.nspname, c.relname, a.attname, a.attacl::text AS column_acl
FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','storage') AND a.attnum>0 AND NOT a.attisdropped
  AND a.attacl IS NOT NULL
ORDER BY n.nspname,c.relname,a.attname;
SELECT n.nspname, p.oid::regprocedure AS function_signature,
  pg_get_userbyid(p.proowner) AS owner_role, p.prosecdef AS security_definer,
  p.proconfig AS function_settings, p.proacl::text AS function_acl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','artfolio_private') ORDER BY 1,2;
SELECT pg_get_userbyid(d.defaclrole) AS grant_owner, n.nspname,
  d.defaclobjtype, d.defaclacl::text AS default_acl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace
WHERE n.nspname IN ('public','storage','artfolio_private') OR n.oid IS NULL
ORDER BY 1,2,3;
COMMIT;
```

Check **effective** privileges separately; explicit ACLs alone miss grants through `PUBLIC` or role membership. Missing `anon`, `authenticated`, or `service_role` rows are themselves a stop condition. Review unexpected `CREATE`, private-table `SELECT`, column `SELECT`, sequence `USAGE`, or function `EXECUTE` results.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT r.rolname, n.nspname, c.relname,
  has_table_privilege(r.rolname,c.oid,'SELECT') AS can_select,
  has_table_privilege(r.rolname,c.oid,'INSERT') AS can_insert,
  has_table_privilege(r.rolname,c.oid,'UPDATE') AS can_update,
  has_table_privilege(r.rolname,c.oid,'DELETE') AS can_delete
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated','service_role')
  AND n.nspname IN ('public','storage') AND c.relkind IN ('r','p','v','m','f')
ORDER BY r.rolname,n.nspname,c.relname;
SELECT r.rolname, n.nspname, c.relname, a.attname,
  has_column_privilege(r.rolname,c.oid,a.attname,'SELECT') AS can_select
FROM pg_roles r CROSS JOIN pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated','service_role')
  AND n.nspname='public' AND c.relkind IN ('r','p')
  AND a.attnum>0 AND NOT a.attisdropped
ORDER BY r.rolname,n.nspname,c.relname,a.attnum;
SELECT r.rolname, n.nspname, c.relname,
  has_sequence_privilege(r.rolname,c.oid,'USAGE') AS can_use,
  has_sequence_privilege(r.rolname,c.oid,'SELECT') AS can_select
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE r.rolname IN ('anon','authenticated','service_role')
  AND n.nspname='public' AND c.relkind='S'
ORDER BY r.rolname,n.nspname,c.relname;
SELECT r.rolname, n.nspname, p.oid::regprocedure AS function_signature,
  has_function_privilege(r.rolname,p.oid,'EXECUTE') AS can_execute
FROM pg_roles r CROSS JOIN pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE r.rolname IN ('anon','authenticated','service_role')
  AND n.nspname IN ('public','artfolio_private')
ORDER BY r.rolname,n.nspname,function_signature;
SELECT r.rolname, n.nspname,
  has_schema_privilege(r.rolname,n.oid,'USAGE') AS can_use,
  has_schema_privilege(r.rolname,n.oid,'CREATE') AS can_create
FROM pg_roles r CROSS JOIN pg_namespace n
WHERE r.rolname IN ('anon','authenticated','service_role')
  AND n.nspname IN ('public','storage','artfolio_private')
ORDER BY r.rolname,n.nspname;
COMMIT;
```

Review the full policy inventory privately. This safe overview omits policy expressions because they could contain embedded literals; inspect each unexpected predicate in the Dashboard without exporting secrets. An existing permissive policy must not be assumed harmless merely because another policy denies access.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT n.nspname, c.relname, c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','storage') AND c.relkind IN ('r','p')
ORDER BY 1,2;
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
  qual IS NOT NULL AS has_using, with_check IS NOT NULL AS has_check,
  lower(btrim(coalesce(qual,''))) IN ('true','(true)') AS broad_using,
  lower(btrim(coalesce(with_check,''))) IN ('true','(true)') AS broad_check
FROM pg_policies WHERE schemaname IN ('public','storage')
ORDER BY schemaname,tablename,policyname;
COMMIT;
```

Check required Auth/Storage columns and types. The bundle requires `auth.sessions(id,user_id,not_after,created_at)`, `storage.buckets(id,name,public,file_size_limit,allowed_mime_types)`, and `storage.objects(bucket_id)`. It also requires roles `anon`, `authenticated`, and `service_role`. After confirming the tables exist, verify that the chosen execution role can read `auth.sessions`, insert/update `storage.buckets`, and is authorized to create a policy on `storage.objects` (ownership or equivalent administrative privilege).

```sql
BEGIN TRANSACTION READ ONLY;
SELECT rolname, rolsuper FROM pg_roles
WHERE rolname IN ('anon','authenticated','service_role',current_user)
ORDER BY rolname;
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable
FROM information_schema.columns
WHERE (table_schema='auth' AND table_name IN ('users','sessions','mfa_factors'))
   OR (table_schema='storage' AND table_name IN ('buckets','objects'))
ORDER BY table_schema,table_name,ordinal_position;
SELECT has_table_privilege(current_user,to_regclass('auth.sessions'),'SELECT') AS can_read_sessions,
  has_table_privilege(current_user,to_regclass('storage.buckets'),'SELECT, INSERT, UPDATE') AS can_manage_bucket_metadata;
COMMIT;
```

Only after the Storage schema check passes, count objects without selecting their names or paths. The repository bucket IDs are `artworks-public`, `artworks-private`, and `commission-private` (which holds commission references and deliverables). Any object in `artworks-public` needs private review: the migration's conflict branch sets that bucket to public.

```sql
BEGIN TRANSACTION READ ONLY;
SELECT expected.id AS bucket_id, b.id IS NOT NULL AS exists,
  b.public, b.file_size_limit, b.allowed_mime_types,
  count(o.id) AS object_count
FROM (VALUES ('artworks-public'),('artworks-private'),('commission-private')) AS expected(id)
LEFT JOIN storage.buckets b ON b.id=expected.id
LEFT JOIN storage.objects o ON o.bucket_id=expected.id
GROUP BY expected.id,b.id,b.public,b.file_size_limit,b.allowed_mime_types
ORDER BY expected.id;
COMMIT;
```

If `public.artworks` or `public.commissions` exists, that alone blocks the fresh-project bundle. For a reconciliation plan, inspect only aggregates after verifying the named columns exist. Never select customer records or artwork text/images.

```sql
-- Run only if public.artworks has publication_status, sale_status,
-- wall_identifier and draft_wall_identifier.
BEGIN TRANSACTION READ ONLY;
SELECT publication_status, sale_status, count(*) AS artwork_count
FROM public.artworks GROUP BY publication_status,sale_status ORDER BY 1,2;
SELECT count(*) AS duplicate_active_slot_groups FROM (
  SELECT wall_identifier FROM public.artworks
  WHERE publication_status <> 'archived' AND wall_identifier IN
    ('sanctuary-apex','entrance-west','main-west-1','main-west-2',
     'main-east-1','main-east-2','west-gallery-1','west-gallery-2',
     'east-wing-1','east-wing-2')
  GROUP BY wall_identifier HAVING count(*)>1
) duplicates;
SELECT count(*) AS duplicate_draft_slot_groups FROM (
  SELECT draft_wall_identifier FROM public.artworks
  WHERE publication_status <> 'archived' AND draft_wall_identifier IS NOT NULL
  GROUP BY draft_wall_identifier HAVING count(*)>1
) duplicates;
COMMIT;
```

If `public.commissions.request_reference` exists, the existing inventory already reports duplicate-group **count**. Confirm it is zero without listing references. Review existing statuses and constraint definitions before any proposed forward repair. A fresh-project bundle must not be used to repair populated or partially migrated tables.

## Gate C — migration-history reconciliation

1. Match the Dashboard migration versions, table/column/index/constraint inventory, policies, grants, and bucket state to the manifest and runbook. Treat a version whose hosted SQL differs from a locally edited historical file as a different migration; do not replay it.
2. Prefer an approved migration method that records history consistently. If SQL Editor is deliberately chosen for the guarded bundle, record the exact project/branch, approver, execution role, timestamp, bundle SHA-256, source hashes, transaction outcome, and post-application schema evidence in a separate deployment ledger. SQL Editor does **not** register CLI versions.
3. Before any later CLI deployment, compare recorded CLI history with that ledger and the actual schema. Stop if the CLI proposes replaying applied statements. Create a reviewed forward-only baseline/repair plan through the supported deployment workflow; do **not** insert fabricated versions, edit `supabase_migrations.schema_migrations`, or use `db push`/`db reset` to force agreement.

## Gate D — publication-coordinate regression proposal (no production edit here)

`20261011030000_artwork_publication.sql` originally defined `set_exhibition_publication(true, ...)` to clear `wall_identifier`, `position_3d`, and `rotation_3d` from every nonarchived placed artwork, then restore only `wall_identifier` for staged published rows. The separate `20261016000000_preserve_exhibition_coordinates.sql` replaces that function without altering the historical migration. It has been applied to the rehearsal project and tested there; production has not received it.

The forward fix clears only active `wall_identifier`; it retains existing coordinate columns. If canonical slot geometry must be persisted after a future slot change, calculate and update it explicitly from a staged source in the same transaction. The focused regression seeds custom coordinates, publishes twice, hides and republishes, then checks that coordinates and wall placement survive. Do not edit the historical migration to disguise an already-applied version.

## Gate E — extra hosted legacy tables

Read-only production metadata found `artworks_legacy_20260924`, `commissions_legacy_20260924`, and `users` outside the original 13-file hardening inventory. The latter two contain rows and have public table/column grants with unconditional policies. The application source has no references to those three names. `20261016010000_secure_legacy_public_tables.sql` conditionally restricts their access without deleting rows; a synthetic populated fixture and a rollback-only rehearsal test passed. The rehearsal project has no such tables, so production must be checked again after a separately approved application. Do not confuse the partial public-table snapshot with a complete backup or restore test.

**Decision rule:** the owner explicitly waived backup/restore evidence for the separate disposable rehearsal and paid/scheduled backups for production; those waivers do not prove recoverability. Recheck target identity, current schema/data counts, grants, history, and the exact guarded bundle immediately before any production application. Production remains unchanged until a separate final approval. Verify Gates D and E against production after application; do not claim that a partial public-table snapshot restores Auth, Storage, roles, or hosted settings.
