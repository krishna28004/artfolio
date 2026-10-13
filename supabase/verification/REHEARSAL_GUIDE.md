# ARTfolio — Database Migration Rehearsal & Verification Guide

This guide provides the exact, step-by-step procedure to safely rehearse pending database migrations against a **disposable Supabase project** before touching the production database.

> [!CAUTION]
> **STRICT SAFETY RULE:**
> NEVER apply migrations directly to production without completing this rehearsal.
> Migrations must be verified in an isolated environment first.

---

## 1. Migration Inventory & Execution Sequence

The following 6 migrations are pending application. They must be executed in this exact order:

| Step | Migration File | Purpose & Objects Created | Rollback Command |
|---|---|---|---|
| **1** | `20261011000000_commission_reference_public_id.sql` | Adds `public_id` column to `public.commissions` | `ALTER TABLE public.commissions DROP COLUMN IF EXISTS public_id;` |
| **2** | `20261011010000_private_commission_workflow.sql` | Adds request references, tracking tokens, `commission-private` storage bucket, `commission_files`, `commission_events`, `notification_jobs`, `payment_events`, and `commission_refunds` tables with strict RLS | Drop newly created tables and remove added columns |
| **3** | `20261011020000_atomic_deliverable_release.sql` | Creates transactional stored procedures (`ensure_commission_submission_events`, `apply_commission_transition`, `accept_commission_quote_with_notice`, `attach_commission_order`, `record_commission_capture`, `record_commission_refund`, `release_commission_deliverables`) | `DROP FUNCTION IF EXISTS public.apply_commission_transition(...);` (and other RPCs) |
| **4** | `20261011030000_artwork_publication.sql` | Adds `publication_status`, `sale_status`, `draft_wall_identifier`, `exhibition_settings` table, museum slot constraints, and patches `artwork_views` RLS | Revert artwork RLS and drop `exhibition_settings` |
| **5** | `20261011040000_artist_workspace.sql` | Adds `owner_last_seen_at` to commissions, unread counts RPC, and `quote_templates` table with write auditing | `DROP TABLE IF EXISTS public.quote_templates;` |
| **6** | `20261013000000_owner_session_revocation.sql` | Creates `is_owner_session_active(uuid, uuid)` validating session row existence in `auth.sessions` | `DROP FUNCTION IF EXISTS public.is_owner_session_active(uuid,uuid);` |

---

## 2. Rehearsal Environment Setup

### Step 2.1: Create a Disposable Supabase Project
1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Click **New Project** and name it `artfolio-rehearsal` (or select an existing disposable development project).
3. Choose the same region as your production project.
4. Copy the project credentials from **Project Settings > API**:
   - `Project URL`
   - `anon public` key
   - `service_role secret` key
   - `Project Reference ID`

### Step 2.2: Configure Disposable Test Environment
1. In your local terminal, create an untracked local file (e.g., `disposable.env` outside Git or inside `.gemini/scratch`):
   ```env
   ARTFOLIO_TEST_PROJECT_REF="your-rehearsal-ref-id"
   ARTFOLIO_TEST_SUPABASE_URL="https://your-rehearsal-ref-id.supabase.co"
   ARTFOLIO_TEST_SUPABASE_ANON_KEY="your-rehearsal-anon-key"
   ARTFOLIO_TEST_SUPABASE_SERVICE_ROLE_KEY="your-rehearsal-service-role-key"
   ```
2. **Never commit this file or paste its values into chat.**

---

## 3. Migration Execution on Disposable Project

Execute the baseline migrations first (if the disposable project is blank):
- `supabase/migrations/20260923000000_initial_schema.sql`
- `supabase/migrations/20260924000000_production_schema_and_seed.sql`
- `supabase/migrations/20260924010000_secure_commission_rls.sql`
- `supabase/migrations/20260924020000_fix_payment_constraints.sql`

Then execute the 6 pending migrations in order (1 through 6) via the **SQL Editor** in the Supabase Dashboard.

---

## 4. Automated Post-Migration Verification

Run the repository verification preflight with your disposable project credentials:

```bash
node --env-file=disposable.env supabase/verification/verify-disposable-supabase.mjs
```

### What this script validates:
- [x] All 11 tables (`commissions`, `commission_files`, `commission_events`, `notification_jobs`, `payment_events`, `commission_refunds`, `payments`, `audit_logs`, `quote_templates`, `exhibition_settings`, `artwork_views`) reject anonymous access (`HTTP 42501` permission denied or zero rows).
- [x] Anonymous clients querying `artworks` can only read items where `publication_status = 'published'`.
- [x] `commission-private` storage bucket exists and is strictly private (`public = false`).
- [x] `artworks-public` storage bucket exists and is public (`public = true`).
- [x] Privileged RPCs (`commission_business_metrics`, `commission_unread_counts`, `is_owner_session_active`) reject anonymous execution and function under `service_role`.

---

## 5. Production Rollout Checklist (Only after Rehearsal Passes)

1. **Create Database Backup:** In production Supabase dashboard, trigger a manual backup snapshot (**Database > Backups**).
2. **Apply Telemetry Fix Immediately (P0):**
   Execute `supabase/verification/telemetry-access-remediation.sql` in production SQL Editor to eliminate the active IP hash leak.
   Verify by running `node supabase/verification/verify-configured-supabase.mjs`.
3. **Apply Pending Migrations in Order:**
   Run migrations 1 through 6 sequentially during a scheduled maintenance window.
4. **Post-Deployment Verification:**
   Run `npm run preflight` to confirm all server secrets and environment variables are active in Vercel before toggling `ARTFOLIO_COMMISSIONS_ENABLED=true` and `ARTFOLIO_PAYMENTS_ENABLED=true`.
