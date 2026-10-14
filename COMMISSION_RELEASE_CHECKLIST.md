# Commission workflow release checklist

This is a local implementation checklist, not evidence of a live deployment. The changes in `supabase/migrations/20261011000000_commission_reference_public_id.sql` and `20261011010000_private_commission_workflow.sql` have **not** been applied to an external database in this task. Keep public commission submission disabled until the isolated-service checks below pass.

## Implemented paths

- Guest inquiry uses a server-generated request reference and a bearer tracking token whose hash is stored on the commission. Opening the link exchanges the token for a scoped, HttpOnly cookie. Rotation invalidates the previous token.
- JPG, PNG, WebP and PDF reference files go through the server validator into the private `commission-private` Supabase bucket. A one-time claim attaches each staged file to an inquiry. Stale unclaimed files are removed by the authenticated cleanup job. Owner and customer file access creates 60-second signed URLs only after authorization.
- The owner sends a versioned quote with price, scope, terms, delivery date and revision allowance. The customer accepts that version before a checkout token is issued; acceptance and its timeline event commit in one database transaction. The old direct approve/reject endpoints return `410` for authenticated callers; the current owner UI uses the event-backed action route.
- Razorpay order attachment and captured payment recording use database RPC transactions. The webhook stores an event receipt and retries on persistence failure. Refund ledger, captured-payment status and event acknowledgement are committed together by `record_commission_refund`; a late `refund.created` cannot reverse a processed refund. Owner reconciliation fetches the gateway order and payments before recording a missing capture.
- Commission and payment timeline records feed customer tracking and owner views. Notification jobs have dedupe keys, a five-minute claim lease, retries and Resend idempotency keys. If Resend is absent, jobs remain pending.
- Admin payments, analytics, audit and operational settings pages use persisted records and server-side owner authorization. Artwork views represent approximate view events, not unique visitors. Traffic source is not collected and is therefore not shown as measured data.

## Environment and deployment sequence

1. Back up the current Supabase database and Storage metadata, confirm a restore procedure, and record the current deployment revision. Apply migrations in filename order to a disposable Supabase project first. Inspect SQL errors, existing rows, RLS/grants, and the private bucket with anon, customer, and service-role clients. Only then schedule the same migrations for the intended production project. The migration adds tables and changes the commission status constraint; rollback requires a reviewed data-aware migration or database restore, not blind drops.
2. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL` for the owner login (and optionally `ADMIN_NOTIFICATION_EMAIL` for alerts), Razorpay test-mode `RAZORPAY_KEY_ID`, `RAZORPAY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `CRON_SECRET`, and canonical HTTPS `NEXT_PUBLIC_SITE_URL`. Configure `RESEND_API_KEY` and verified `RESEND_FROM_EMAIL` for mail. Configure Upstash URL/token for distributed rate limits. Keep service keys server-only. Rotate exposed keys if any were previously published.
3. Schedule authenticated GETs for `/api/cron/notification-jobs`, `/api/cron/cleanup-staging`, and the existing expiry cleanup endpoint, using `Authorization: Bearer <CRON_SECRET>`. Monitor failed/pending notification jobs and received payment events.
4. In Razorpay **test mode**, run a complete approved-quote checkout and verify the gateway order, payment, database ledger, status, timeline and notification. Repeat for failed/cancelled checkout, delayed/duplicate/out-of-order callbacks, DB outage followed by webhook retry or owner reconciliation, partial refund, full refund and over-capture/mismatched payload. Never send a real charge or refund during these checks.
5. Test a real Resend message, provider rejection, retry after worker interruption and deduplication. Check that tracking links use the canonical domain and no permanent private file URL appears in email, public HTML or analytics.
6. Review and approve customer-facing quote, cancellation, revision, usage-rights, privacy/retention and refund policies before launch. The current quote terms are entered per request; the application does **not** encode a universal legal refund policy or initiate refunds automatically. A refund request is review-only until the owner acts in the gateway.
7. Test owner login/renewal/logout and recovery with the intended account. Test customer A versus B tracking/file access, token rotation, upload MIME/content/size/count limits, stale cleanup, deliverable access and mobile/desktop interaction in an isolated service environment. Capture audit logs and provider IDs without logging tokens or secrets.
8. Configure error monitoring, backup alerts and webhook retry visibility. For rollback, stop new commission submissions/checkouts, retain gateway webhook delivery and ledger data, revert the application deployment, and restore only after reconciling captured gateway payments. Do not remove new tables or private files while live payments may still reference them.

## Local evidence and launch decision

The repository checks use mocks for Supabase and Razorpay. Browser checks cover the public form shell and validation at desktop/mobile sizes without live service credentials. They do not verify SQL compilation, actual RLS/storage permissions, owner session flows, email delivery, or Razorpay callbacks. Missing live credentials and migration access therefore mean **NO-GO for public payment launch** until the preceding isolated-service checks and owner policy decisions pass.

Remaining consistency risk: most owner/customer status changes still perform the status update and timeline insert as two separate database requests. If the second write fails, the status can change without a matching event or notification. A reviewed transaction wrapper for these remaining transitions, plus live failure-injection testing, is required before relying on the timeline as a complete audit record.

## Master recovery checkpoint — 2026-10-13

This section tracks recovery after main was reverted to da9545e78ee46d35793185a5615fb95beb1b9538. The older evidence above is historical. Initial working tree: clean. Git's local origin/main reference matches main; no fetch or remote deployment verification has been performed. The revert's tracked tree is identical to baseline 94568ef2896dc0b685cf94cdbf9654aaf88a3839. No production changes are authorized.

| Area | Actual status at initial audit | Severity / evidence / dependency | Next action |
| --- | --- | --- | --- |
| Git history and preservation | DONE AND VERIFIED | Release 24861ca changed 92 files; da9545e reverts it entirely; git diff 94568ef HEAD is empty | Preserve the revert and restore individual reviewed files only |
| Selected Works design | REVERTED — RECOVERY REQUIRED | Gallery.tsx is the plain toggle; Gallery.module.css and both editorial PNGs are missing | Recover those UI files from 24861ca and validate seven viewports |
| Carousel / artwork accessibility | REVERTED — RECOVERY REQUIRED | Carousel hover pause and nested-link heart control returned; source diffs confirm | Recover reviewed interaction and accessibility changes |
| Public catalog and artwork pages | BROKEN | High: prior release requires publication_status and converts query errors into empty results; current artwork-service returns static records for errors AND empty results | Deliberate anonymous-client legacy compatibility, published-only modern queries, genuine empty state and explicit failure states |
| Exhibition / saved views | BROKEN | High: exhibition falls back to static placements; saved fetch failure looks empty | Keep persisted catalog authoritative, distinguish loading/error/empty, preserve museum movement |
| Owner security | REVERTED — RECOVERY REQUIRED | High: current auth checks owner email but no confirmed-email/MFA/active-session checks | Recover safe authorization and login controls; actual Auth/session lifecycle requires rehearsal |
| Commission transactions / staged release | IMPLEMENTED BUT NOT VERIFIED | High: baseline retained payment RPCs/private files, but remaining status/event/outbox writes are separate and draft access lacks release timestamp | Recover reviewed atomic migration and application paths; do not enable intake/payments |
| Customer recovery | REVERTED — RECOVERY REQUIRED | Medium: route/UI removed; original route waits for known-email notification delivery and writes recovery event/outbox separately | Repair enumeration timing and durable recovery before restoring this route |
| Telemetry privacy | WAITING FOR MANUAL SETUP | High: baseline migrations allow raw artwork_views reads/inserts. Earlier read-only diagnostics confirmed exposure, but current hosted remediation state is NOT VERIFIED | Inspect grants/RLS; rehearse narrow patch; preserve aggregate count endpoint; never blindly reapply |
| Migration / rehearsal files | REVERTED — RECOVERY REQUIRED | High: only six migration files remain; four later files and verification scripts were reverted. First baseline policies and several constraints are not replay-safe | Recover reviewed SQL/tests/inventory; reconcile hosted migration history before any execution |
| Environment / hosting | WAITING FOR MANUAL SETUP | Public Supabase URL/key and site URL present. Local service role, owner, Redis, Razorpay, Resend and cron credentials missing. CLI metadata links a different project name | Confirm existing artfolio-rehearsal is disposable; configure dedicated test variables privately; keep local/Preview/Production separate |
| Hosted integration checks | BLOCKED | No verified disposable credentials, DB connection, owner test account or provider test configuration | Stop before hosted mutations and request one manual checkpoint at a time |
| Monitoring / backups / cron scheduling | WAITING FOR MANUAL SETUP | No repository hosting schedule or configured monitoring found; provider settings and tested restore are unknown | Verify in hosting/provider dashboards later; document reviewed rollout/rollback |
| Production readiness | BLOCKED | Local tests cannot establish hosted privacy, MFA, payments or migrations | NO-GO for real commissions/payments |

### Recovery progress

- Phase 1: initial code/history/environment audit complete; the table above records evidence.
- Phase 2: DONE AND VERIFIED locally; approved illustrations restored and seven viewport checks pass.
- Phase 3: DONE AND VERIFIED locally; current production column mismatch confirmed read-only. Deployment verification remains open.
- Phase 4: local SQL recovery/review complete; hosted inventory and disposable rehearsal WAITING FOR MANUAL SETUP.
- Phase 5–9: security recovery, integrations and release gates remain open.
- No migration, deployment, commit, push, real charge/refund or provider setting change has been performed.
### Current release-validation results — 2026-10-13

The current source remains uncommitted on the reverted main HEAD. These results supersede the initial audit statuses for recovered areas only. No production data, schema, settings, launch flags or .env.local values were changed.

| Item | Current status | Evidence / remaining dependency |
| --- | --- | --- |
| Approved editorial UI and carousel | VERIFIED PASS — local | Seven Chrome viewports; heading/overline/subtitle centered within 0.008 CSS px, no horizontal document overflow; actual count, expand/collapse, inert state, one toggle/pause control, keyboard focus and reduced motion pass |
| Navigation and homepage layout | VERIFIED PASS — local | Existing navigation browser runner passes desktop/tablet/mobile portrait/landscape, menu/Escape, feature dock destinations, portrait and carousel; console/runtime errors: 0 |
| Museum controller preservation | VERIFIED PASS — local | Existing movement browser runner passes desktop collision/slide/retreat, doorway sprint, modal pose, denied pointer lock, mobile multitouch/modal, landscape bounds and tab return |
| Catalog recovery and API behavior | VERIFIED PASS — local | 18 new regressions plus production-mode browser tests: legacy public schema, published-only modern reads, hidden draft/archive detail, genuine empty, 503/no-store, no false 404, saved choices and retry |
| Current hosted catalog schema | FAILED — ACTION REQUIRED | Zero-row production probes individually return 42703 for publication_status, sale_status and draft_wall_identifier. Public catalog is reachable; recovered code has not been deployed |
| Hosted private-workflow schema | NOT VERIFIED — ACTION REQUIRED | PostgREST returns PGRST205 for commission_files, commission_events, notification_jobs, payment_events, commission_refunds and quote_templates; inventory must distinguish missing DB objects from schema-cache/grant problems |
| Current anonymous telemetry reads | VERIFIED PASS — narrow read-only check | Separate zero-row reads of id, artwork_id, ip_hash and viewed_at each return 42501. Do not blindly reapply remediation. Authenticated access and full grants/policies remain NOT VERIFIED |
| Migration compilation / transactions / RLS | VERIFIED PASS — local only | Ten files execute in PostgreSQL 18.6 / PGlite 0.5.9; all 19 checks pass, including atomic release rollback, duplicate capture/refunds, publication privacy, inherited column grants, outbox, private claims and owner-session fixture |
| Hosted migrations / RLS / Storage objects | MANUAL SETUP REQUIRED | No hosted SQL applied. Local minimal Auth/Storage fixtures do not establish actual service grants, uploads/downloads, concurrency or schema/history reconciliation |
| Commission/payment launch controls | VERIFIED PASS — local | ARTFOLIO_COMMISSIONS_ENABLED and ARTFOLIO_PAYMENTS_ENABLED require exact true, default closed. Submission/upload/order handlers reject before provider access when closed; form receives the intake state |
| Owner MFA/session, login/recovery limits, customer recovery | FAILED — ACTION REQUIRED | Safe hardening is still reverted/not recovered. Known original recovery timing/atomicity defects require repair; real Auth recovery and session lifecycle are unverified |
| Atomic commission application paths / workspace CMS | FAILED — ACTION REQUIRED | SQL recovered, but remaining transition/release/application and artist-workspace changes are not yet recovered or integrated. Baseline separate event/outbox writes remain |
| Razorpay / Resend / Upstash / cron / monitoring / backups | MANUAL SETUP REQUIRED | No sandbox checkout/refund, actual email delivery, distributed limiter, schedules, monitoring or restore test executed; local server-role/owner/provider configuration missing |
| Production release decision | NO-GO | No deployment requested. Real commissions/payments stay closed until hosted rehearsal, schema/RLS/Storage/MFA and Preview/provider integration checks pass |

Executed checks:

- npm test: 261 passed, 0 failed, 0 skipped.
- npx tsc --noEmit --incremental false: exit 0.
- npm run lint: exit 0, no warnings after the final harness/diagnostic fixes.
- npm run build: exit 0 using synthetic loopback Supabase configuration and closed launch flags; no production build-time data calls.
- tests/selected-works-browser.mjs: 360x800, 390x844, 430x932, 768x1024, 1024x768, 1720x1000 and 844x390 pass; console/runtime errors: 0.
- tests/homepage-navigation-browser.mjs: pass against the production-mode local fixture.
- tests/exhibition-browser.mjs: final run passes with no console/runtime errors. An earlier mobile attempt timed out behind the asset loading overlay; the harness now waits for actual joystick hit tests and selects the dedicated touch-look surface. The overlay was not hidden or bypassed.
- tests/catalog-states-browser.mjs: pass for explicit API failures/privacy, detail/saved error notices, genuine empty exhibition and retry; injected failed HTTP requests are expected, uncaught exceptions: 0.
- supabase/verification/validate-local-postgres.mjs: 19/19 pass, 10 migrations; no hosted database connection.
- supabase/verification/verify-configured-supabase.mjs: read-only production diagnostics; statuses/codes only, no returned customer rows or environment values printed.
- supabase/verification/verify-disposable-supabase.mjs: NOT RUN against a hosted project. Requires separately confirmed disposable identity and dedicated ARTFOLIO_TEST_* configuration. Empty source tables are NOT VERIFIED rather than vacuous security passes.

Migration safety changes are deliberately local: null quote guards; publication migration revokes inherited telemetry column grants and preserves service sequence access; exhibition settings/quote templates revoke PUBLIC access. Do not replay modified historical migrations if already recorded remotely: compare versions and schema, then prepare reviewed forward repairs. Baseline migrations contain non-repeatable policies/constraints and seed/state updates; blind replay or down-migration is unsafe. See supabase/verification/REHEARSAL_GUIDE.md and pre-migration-inventory.sql.

Remaining metadata issue: artwork metadata currently lacks metadataBase; a local runtime warning used the local host for social image resolution. Validate the canonical public site URL and metadata base during the hosting/environment phase.

Remaining browser scope: granted native pointer lock, physical iOS/Android/Safari/Firefox, offline or degraded third-party HDR loading, and real provider/account flows have not been verified. No pre-change browser screenshots were captured in this recovery checkpoint; approved references and revert source were inspected, and seven current screenshots plus failure-state screenshots were saved.

Next checkpoint (read only): open https://supabase.com/dashboard/projects, select the existing artfolio-rehearsal project and confirm its name and that it is disposable with no live customer data. If absent or uncertain, report that. No SQL, new paid project, credentials in chat or settings change is required at this checkpoint. Hosted changes wait for target confirmation, reviewed inventory and rehearsal; production additionally requires backup and explicit approval.
## Security rehearsal checkpoint — 2026-10-14

The security pass is on local branch `codex/supabase-security-rehearsal` at reverted HEAD `da9545e78ee46d35793185a5615fb95beb1b9538`. The earlier recovery/UI work remains uncommitted. A pre-branch hash snapshot of 225 existing files showed zero missing files and no changed editorial/Gallery/carousel/About/museum-control files after the security edits. No remote database connection, Supabase command, migration application, provider operation, deployment, commit or push occurred in this pass. The Dashboard branch labelled **PRODUCTION** has not been reconciled with the exact proposed `artfolio-rehearsal` project reference.

| Gate | Current result | Evidence / pending condition |
| --- | --- | --- |
| Commission privacy and RPC hardening | VERIFIED PASS — synthetic local SQL only | 11 migrations execute and 31/31 PGlite checks pass with populated anon/auth roles, grants, RLS, private function paths, legal transitions, rollback and idempotency. Actual hosted roles and Storage object behavior remain unverified. |
| Owner MFA and session checks | VERIFIED PASS — mocked code/SQL only | Server checks confirmed owner email, AAL2, verified JWT claims and active session; the password-only bootstrap returns no data. Real Auth enrollment, sign-out, recovery and provider rate limits remain manual. |
| Artwork, quote, files and payments | VERIFIED PASS — local tests only | Published-only catalog, draft creation/archive, private deliverable release, displayed quote version/expiry, signed webhook deduplication, order/amount/currency and refund ledger checks passed. Sandbox and real Storage tests remain pending. |
| Local code gates | VERIFIED PASS | 285/285 Node tests; TypeScript exit 0; ESLint exit 0; standard Turbopack production build exit 0 using synthetic loopback Supabase and both launch flags false. Earlier generated Next.js route typing errors were corrected; first build attempt also hit local memory pressure before a successful rerun. |
| Production-mode browser | VERIFIED PASS — local fixture | Catalog privacy/error-state runner passed; Selected Works passed seven viewports with no overflow, centering drift, unexpected gap or console/runtime errors; grid, keyboard, pause/resume and reduced motion passed. Ten screenshots saved under `C:\Users\user\Documents\Codex\2026-10-13\lo\outputs\supabase-security`. |
| Disposable target/config | NOT VERIFIED | Offline preflight found dedicated `ARTFOLIO_TEST_*` values and confirmation absent. Exact project reference/branch, history, Auth and Storage prerequisites need Dashboard review before any later authorized rehearsal. |
| Hosted integration and operations | NOT VERIFIED | No live Supabase RLS/Storage/MFA/account recovery, Razorpay test-mode capture/refund, Resend, Upstash, cron, backup/restore or multi-connection checks. A late capture after an owner cancelled an expired order needs a reviewed reconciliation path. |
| Release decision | **NO-GO** | Real commissions/payments remain closed until hosted rehearsal and provider gates pass with separate authorization. |

See `SUPABASE_SECURITY_REVIEW.md` for severity-ranked findings and RPC caller traces, and `SUPABASE_REHEARSAL_RUNBOOK.md` for the exact 11-file order, manual Dashboard actions, offline checks, safe review commands and recovery guidance. Both are local-only documents. The next action is read-only confirmation of the existing disposable project's exact reference and branch in the Dashboard; it does not authorize SQL.
