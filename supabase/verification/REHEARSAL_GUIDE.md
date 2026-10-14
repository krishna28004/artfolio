# Supabase rehearsal and migration reconciliation

This guide prepares a reviewed checkpoint. No hosted migration has been run in this recovery session. Local SQL checks use synthetic Auth and Storage tables and do not establish hosted safety. Keep ARTFOLIO_COMMISSIONS_ENABLED and ARTFOLIO_PAYMENTS_ENABLED false.

## Current manual checkpoint — read only

1. Open https://supabase.com/dashboard/projects.
2. Locate the existing project named **artfolio-rehearsal**. Do not use the production project or the current CLI link as a substitute, and do not create another paid project yet.
3. Open that project and check its displayed project name. Confirm it is disposable and contains no real commissions, payments, private customer files or users who depend on it.
4. Reply with the project name and whether it is disposable. If it is absent or uncertain, report that instead.
5. This step changes no data or settings. No undo is needed. Do not send API keys, project URLs, connection strings or dashboard screenshots containing credentials.

Wait for review of this result before the next checkpoint. The steps below describe the eventual process, not authorization to execute it.

## Read-only inventory after target confirmation

Run pre-migration-inventory.sql in the selected project's SQL Editor, then review its schema, recorded migration versions, grants, policies, constraints, indexes, bucket metadata and Auth session columns. It selects no customer rows or tokens. Check that the SQL Editor remains on the confirmed target. Migration-history statements intentionally omit SQL bodies because historical bodies can contain sensitive information.

Record counts and structural findings privately. Empty anonymous results alone do not prove a private table is protected. Test roles with known synthetic populated records, and inspect table/column/sequence grants and policies, including unexpected policies. The latest verifier reports empty-table checks as NOT VERIFIED.

The owner-session RPC requires auth.sessions.id, user_id and not_after. Real sign-out, MFA and session invalidation require actual Supabase Auth tests; the local table fixture cannot validate them.

## Ordered migration inventory

| Order | File | Main dependency / non-replay risk |
| --- | --- | --- |
| 1 | 20260923000000_initial_schema.sql | Creates catalog/commissions and original permissive policies; policies are not replay-safe |
| 2 | 20260924000000_production_schema_and_seed.sql | Adds payment/audit/telemetry tables, seed data and policies; replaying can fail or restore permissive telemetry |
| 3 | 20260924010000_secure_commission_rls.sql | Removes public commission access; inspect unexpected policies and grants |
| 4 | 20260924020000_fix_payment_constraints.sql | Payment nullable ID and capture check; constraint addition is not replay-safe |
| 5 | 20261011000000_commission_reference_public_id.sql | Retains legacy commission object reference; no new Cloudinary setup is needed |
| 6 | 20261011010000_private_commission_workflow.sql | Requires earlier commission/payment fields and storage.buckets; creates private tables/RPCs and status constraints |
| 7 | 20261011020000_atomic_deliverable_release.sql | Requires private workflow tables; atomic state/event/audit/outbox/release; creates a trigger that is not replay-safe |
| 8 | 20261011030000_artwork_publication.sql | Requires artworks/audit/storage; adds publication, slots and grants; initializes legacy sale status; constraints/policy and data updates must not be blindly replayed |
| 9 | 20261011040000_artist_workspace.sql | Requires commission_events/audit; unread state and quote templates |
| 10 | 20261013000000_owner_session_revocation.sql | Requires confirmed hosted auth.sessions columns and function-owner privileges |

These are not a single idempotent bootstrap for an existing project. Compare both migration history and actual schema. Partial/manual installs need a reviewed reconciliation patch; do not repair history merely to make tooling green. If a recorded migration differs from this repository's reviewed contents, prepare a separate forward repair rather than editing hosted history or blindly executing it again.

Before publication migration: check duplicate request references, museum slots and staged slots, invalid status values, inherited grants/policies and existing sale state. Existing rows are initialized published to preserve the original public collection; that requires review if older records were private by another convention. The compatibility code uses anonymous RLS and only a column-specific 42703 probe; it does not make publication drafts available via a server-role fallback.

## Rehearsal execution — separate checkpoint

Use only the confirmed disposable target with explicit dedicated credentials configured privately outside Git using disposable.env.example. The verification tools use ARTFOLIO_TEST_* and never fall back to production credentials. Do not use default supabase db push/reset or a pooled connection cached by an old link.

Apply only the reviewed missing files in order, one migration per transaction through a controlled runner. Verify how the chosen CLI/SQL Editor executes transactions before use. Capture each version and outcome without secrets. On a failure, stop and review; do not paste DROP TABLE/COLUMN commands to make a replay succeed.

Then run commission-release-inspection.sql and the dedicated read-only verifier. With authorized synthetic fixtures, test anonymous AND authenticated access, draft/archive visibility, cross-customer tracking/files, Storage object access (not just bucket metadata), MFA/session lifecycle, duplicate/out-of-order payments, concurrent transitions and injected failures. Clean up only specifically identified disposable fixture records after approval; never use production cleanup SQL.

Local optional validation:
node --wasm-num-compilation-tasks=1 --no-wasm-tier-up supabase/verification/validate-local-postgres.mjs

Requires an available @electric-sql/pglite module, optionally identified with PGLITE_MODULE_PATH. It uses in-memory PostgreSQL, writes no hosted database and contains no real account or storage objects.

## Telemetry remediation checkpoint

telemetry-access-remediation.sql is a narrow prepared security patch, not a command to run immediately. First inspect raw telemetry grants/policies and both anonymous/authenticated access, without retrieving hashes or timestamps into output. If already protected, verify and record the result instead of reapplying. If exposure remains, review the grant snapshot, rehearse the patch and request explicit production approval. Revoking table access alone is insufficient when column grants remain.

## Production rollout and recovery — not authorized

A successful local test or environment preflight is not release approval. Before any production SQL, require hosted rehearsal evidence, a verified backup/restore plan, a reviewed schema/history diff and explicit owner approval. Apply reviewed missing/forward patches only. Verify the public catalog, privacy and server RPCs before Preview integration tests and controlled deployment.

If a deployment fails, leave intake/checkout disabled, keep payment webhooks and ledger reconciliation available, and return the app to a reviewed compatible version. Retain migrated tables, payment history and private files. Database restore or schema removal is a separate reviewed operation after reconciling gateway events and data written since the backup. There is no automatic destructive down-migration.

Real commissions/payments remain NO-GO until hosted migrations, RLS, Storage object privacy, MFA, Preview integration checks, sandbox payments/email and monitoring pass.