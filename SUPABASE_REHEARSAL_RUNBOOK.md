# Artfolio Supabase rehearsal runbook

**Status: preparation only, 14 October 2026.** No remote database, provider, deployment or production payment action was performed in this security pass. The intended target is the existing `artfolio-rehearsal` project, but its exact reference, selected branch, configuration and ownership have not been verified. A dashboard branch label of **PRODUCTION** must be treated as a warning until the exact project is established. Keep `ARTFOLIO_COMMISSIONS_ENABLED=false` and `ARTFOLIO_PAYMENTS_ENABLED=false`. The offline backup and restore gates are detailed in `SUPABASE_RECOVERY_WORKFLOW.md`.

## First manual checkpoint: identify the target, read only

1. In the Supabase Dashboard project list, open the existing `artfolio-rehearsal` project. In Project Settings → General, privately record the displayed **project name and reference ID**. Check the selected branch and its `PRODUCTION` label; confirm that the reference belongs to the disposable test project, not Artfolio's production project.
2. Confirm in the Dashboard that the selected project's public schema has no application tables, and that no users, Storage objects or provider integrations rely on it. The user's prior statement about no live data is context, not a substitute for checking the selected reference.
3. Record the reference privately in an ignored `.env.test.local` file or a file outside Git. Do not put keys or URLs in chat, logs or the runbook. Use **dedicated** `ARTFOLIO_TEST_PROJECT_REF`, `ARTFOLIO_TEST_SUPABASE_URL`, `ARTFOLIO_TEST_SUPABASE_ANON_KEY`, `ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY` and `ARTFOLIO_TEST_DISPOSABLE_CONFIRMED=true`. The offline checker never connects to the project:
   `node --env-file=.env.test.local scripts/rehearsal-preflight.mjs`
   It checks syntax and difference from the default local URL only; it cannot prove account ownership, key privileges or actual project binding. The latest local run passed all format/separation checks; the Dashboard identity and permissions remain unverified.
4. No remote SQL is authorized by this runbook. Only after separate approval, run `supabase/verification/pre-migration-inventory.sql` in the SQL Editor of the exact confirmed project. It is a metadata-only, read-only transaction. Check the project selector immediately before execution. Compare the returned versions, tables, grants, column grants, RLS, policies, indexes, bucket metadata and Auth session columns. Do not paste customer rows, tokens or keys into reports.

## Exact local migration order

| # | File | Dependency and review point |
| --- | --- | --- |
| 1 | `20260923000000_initial_schema.sql` | Initial catalog/commission schema and historical permissive policies. |
| 2 | `20260924000000_production_schema_and_seed.sql` | Payments/audit/telemetry and seed; reviewed seed now leaves existing artist rows alone. |
| 3 | `20260924010000_secure_commission_rls.sql` | Removes original public commission access. |
| 4 | `20260924020000_fix_payment_constraints.sql` | Payment ID/constraint repair. |
| 5 | `20261011000000_commission_reference_public_id.sql` | Public request reference, private tracking fields. |
| 6 | `20261011010000_private_commission_workflow.sql` | Private workflow tables, bucket metadata and payment/quote RPCs. |
| 7 | `20261011020000_atomic_deliverable_release.sql` | Atomic delivery transition and outbox. |
| 8 | `20261011030000_artwork_publication.sql` | Publication/sale/placement fields, public grants, Storage bucket metadata. |
| 9 | `20261011040000_artist_workspace.sql` | Templates, unread state and workspace functions. |
| 10 | `20261013000000_owner_session_revocation.sql` | Requires `auth.sessions(id,user_id,not_after)` and migration-owner access. |
| 11 | `20261013010000_rehearsal_security_hardening.sql` | Private function internals, public wrappers, restrictive RLS/Storage, grants and defaults. |

The first ten contain constraints, policies, triggers or other statements that are **not replay safe**. Three earlier files also have reviewed local edits; do not replay an older hosted migration version with these new bytes. The eleventh is a forward patch and can be repeated alone. For any existing or partially installed project, compare actual schema and migration history, then prepare a reviewed forward repair. Never rewrite `supabase_migrations.schema_migrations` merely to make a tool report success.

For a genuinely empty disposable project, `node scripts/prepare-rehearsal-sql.mjs --output <LOCAL_REVIEW_FILE.sql>` generates a local bundle and SHA-256 manifest. It explicitly checks the 11-file inventory; its single transaction refuses existing public application tables and missing Auth/Storage prerequisites. This is a **review artifact**, not permission to execute it. SQL Editor execution does **not** register individual Supabase CLI migration history versions; reconcile the chosen deployment method and history before any later CLI push. Do not execute the bundle twice or use `supabase db reset`/blind `db push`.

Before a separately approved rehearsal application, confirm: reviewed and **tested** backup/restore path under `SUPABASE_RECOVERY_WORKFLOW.md`; exact project reference and branch; no public app tables or relevant bucket objects; zero duplicate request references/museum slots; expected Auth session columns; no unexpected grants/policies; existing sale/publication state. Confirm that the SQL role can read `auth.sessions`. An unexpected object or constraint is a stop condition requiring a reviewed reconciliation plan.

## Manual Dashboard actions to record before any launch

These are **future checkpoints**, not actions performed or authorization granted by this document.

| Dashboard / owner action | Required evidence |
| --- | --- |
| Supabase Projects → `artfolio-rehearsal` → Settings → General / Branches | Exact project reference, selected branch and reason the branch displays PRODUCTION; written confirmation that it is disposable and separate from the default production project. |
| Supabase Database → Tables / Migrations / SQL Editor | Public application-table inventory, recorded versions and actual schema/policies/grants. Run the read-only metadata inventory only after explicit authorization, and reconcile history before any migration. |
| Supabase Storage → Buckets / Policies / Objects | Bucket public flags, MIME/size rules, object counts and policy list. Test real anon/customer A/customer B reads and writes with synthetic files only after rehearsal approval; inventory every artwork-public object before publishing. |
| Supabase Authentication → Users / Providers / MFA / Rate Limits / URL Configuration | Dedicated confirmed owner test account, disabled or controlled signup, password recovery and redirect policy, provider email limits, TOTP enrollment/challenge, revoked/expired session behavior and a documented account recovery method. Never export factor secrets into the report. |
| Hosting / Preview environment | Separate rehearsal variables, closed launch flags, protected machine secret, verified trusted ingress and Upstash fail-closed behavior; record preview revision and rollback plan. |
| Razorpay test dashboard, Resend, Upstash and scheduler dashboards | Test-mode key/webhook mapping and delivery retries, verified email sender and delivery/retry, distributed limiter availability, cron authentication/schedules and monitoring alerts. No real payment/refund or production switch. |
| Backup / operations dashboard | Recoverable database and Storage metadata backup, tested restore procedure, notification/webhook backlog monitoring and financial reconciliation owner. |
## Deferred verification after separately authorized rehearsal

Run the repository's `supabase/verification/commission-release-inspection.sql` and the metadata inventory; compare with the manifest and expected 11 migrations. Metadata checks alone cannot prove privacy. Create synthetic, clearly marked test records with separate anon, customer A, customer B and owner identities. Verify:

- Anonymous/authenticated clients cannot select any private commission, financial, audit, template, view or outbox row, including column-specific access. They see published artwork columns only, cannot mutate them, and cannot invoke privileged RPCs.
- A draft/archived artwork is hidden from list/detail/view routes and from public database reads. Inventory the `artworks-public` bucket: any publicly addressable object remains public even after its database row is unpublished. Keep draft originals in `artworks-private`; verify actual object reads/writes for both roles and another customer's commission path.
- Owner must have confirmed email, real AAL2 TOTP, matching verified claims and active Auth session. Test enrollment, logout, session revocation, expired session, foreign account, and the deliberate server-to-server `ADMIN_API_SECRET` bypass policy. Review Dashboard Auth signup, password recovery, rate limits and email templates. Do not disclose QR secrets.
- A customer must use the scoped tracking proof. Test stale/missing quote version, expired quote, token rotation, wrong commission/file path, upload size/MIME/count and unreleased deliverable denial.
- In gateway **test mode** only after separately approved Preview setup, test paid, failed, duplicate, delayed capture, mismatched order/amount/currency, partial/full refund, late callbacks, worker retry and reconciliation. Inspect ledger/event/outbox atomicity under injected failures and concurrency. No real charge/refund is part of this runbook.
- Review Redis rate limits, Resend delivery, cron authentication/schedules, monitoring, backups and restore in their own dashboards. Keep launch flags closed until their gates pass.

Read-only metadata spot checks suitable for the confirmed rehearsal SQL Editor, after separate authorization:

```sql
BEGIN TRANSACTION READ ONLY;
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies WHERE schemaname IN ('public','storage')
ORDER BY schemaname, tablename, policyname;
SELECT p.oid::regprocedure, p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname IN ('public','artfolio_private') AND p.prosecdef;
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets WHERE id IN ('commission-private','artworks-public','artworks-private');
COMMIT;
```

On any failed migration within the same SQL connection, stop and `ROLLBACK`; inspect the error and schema/history before retry. If the tool closed the connection or transaction outcome is uncertain, first perform a read-only inventory. Never drop private tables, ledger, audit history or Storage objects as a convenience rollback. For a production incident later, close intake/checkout, preserve webhook and reconciliation paths, reconcile gateway transactions, and use a reviewed application/DB recovery plan and verified backup. Production changes require a distinct explicit approval.

## Exact local review and test commands

From `C:\Users\user\Documents\artfolio` on branch `codex/supabase-security-rehearsal`:

```powershell
git status --short --branch
git diff --check
git diff -- . ':!src/components/blocks/Gallery.tsx' ':!src/components/blocks/CarouselCard.tsx' ':!src/components/blocks/CarouselStrip.tsx'
git ls-files --others --exclude-standard
$env:NODE_OPTIONS='--max-old-space-size=1024 --max-semi-space-size=4'
npm.cmd test
npx.cmd tsc --noEmit --incremental false
npm.cmd run lint
```

The broad Git diff includes the **preexisting uncommitted recovery/UI work** carried onto this branch. Review security paths by filename before treating the entire diff as this pass. The SQL runner requires a local `@electric-sql/pglite` installation (set `PGLITE_MODULE_PATH` to its local `dist/index.js` if installed elsewhere):

```powershell
node --expose-gc --max-old-space-size=1024 --max-semi-space-size=4 --wasm-num-compilation-tasks=1 --no-wasm-tier-up --liftoff-only supabase/verification/validate-local-postgres.mjs
node scripts/prepare-rehearsal-sql.mjs --output <LOCAL_REVIEW_FILE.sql>
```

For a safe local production build, run the fixture in one terminal: `node --experimental-strip-types tests/fixtures/catalog-server.mjs`. In a second terminal in the repository, set **process** variables so the production `.env.local` cannot supply a provider endpoint or credential to the build:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:3102'
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY='artfolio-local-anon-fixture'
$env:SUPABASE_SERVICE_ROLE_KEY='artfolio-local-service-fixture'
$env:ADMIN_EMAIL='local-fixture@example.test'
$env:NEXT_PUBLIC_SITE_URL='http://127.0.0.1:3101'
$env:ARTFOLIO_COMMISSIONS_ENABLED='false'
$env:ARTFOLIO_PAYMENTS_ENABLED='false'
$env:NEXT_TELEMETRY_DISABLED='1'
foreach($n in @('ADMIN_API_KEY','ADMIN_API_SECRET','RAZORPAY_KEY_ID','RAZORPAY_SECRET','RAZORPAY_WEBHOOK_SECRET','NEXT_PUBLIC_RAZORPAY_KEY_ID','RESEND_API_KEY','RESEND_FROM_EMAIL','UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','CRON_SECRET','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET','NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME','TELEMETRY_SALT','VIEW_TELEMETRY_SALT')) { Set-Item "Env:$n" '' }
npm.cmd run build
npm.cmd run start -- --port 3101
```

From another local terminal, set `ARTFOLIO_BROWSER_URL=http://127.0.0.1:3101` and an output directory outside Git, then run `node tests/catalog-states-browser.mjs` and `node tests/selected-works-browser.mjs after`. Stop both local servers afterward. These tests use a loopback catalog and never validate live Supabase, payments or Storage.
The generated SQL/manifest belong in a private local scratch directory, not Git. Build only with synthetic loopback Supabase variables and disabled launch flags, never with the default production `.env.local`; the successful build and browser results for this task are recorded in the security review. No test above exercises a hosted database or actual provider.
