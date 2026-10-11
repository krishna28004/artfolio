# Commission workflow audit and implementation plan

Audit basis: repository at `9101da2d213145d2368e183bdbecd12b486196cb` on `main`, with pre-existing uncommitted exhibition work preserved. This describes the code, not a verified live Supabase or Razorpay deployment.

## Actual architecture and journey

Artfolio is a **single-artist portfolio for Krishna Kumar**, not yet a multi-artist social marketplace. The catalog and artist bio are public; `/commission` renders `CommissionForm`. A visitor supplies name, email, size, budget, optional date/image, and a brief. `POST /api/commission` rate-limits by IP, validates with Zod, and inserts into `commissions` using the Supabase service role. The admin Supabase session/API key gates `/api/admin/commissions`, `/api/admin/approve`, and `/api/admin/reject`. Approval stores a price and 24-hour checkout token, then sends a Razorpay checkout link by Resend when configured. `/checkout/[id]` validates that bearer token, calls `/api/payment/create-order`, and invokes Razorpay Checkout. `/api/payment/verify` and `/api/payment/webhook` mark payment. Migrations define `commissions`, `payments`, and `audit_logs`, with direct public commission access denied by RLS. Cloudinary receives uploaded reference images.

There are no customer accounts, artist accounts beyond the one admin identity, artist offerings/availability records, messages, milestones, progress previews, deliverables, customer approval, or a refund policy/workflow. The implemented `paid` and `fulfilled` states do not amount to an end-to-end commission lifecycle: no UI action moves paid work through creation or delivery. Existing automated tests include schema, payment models, security route mocks, and production-readiness checks; payment-model tests copy route logic rather than executing it.

## Confirmed defects and risks before implementation

| Priority | Evidence | Consequence |
| --- | --- | --- |
| P0 | `api/payment/verify/route.ts` checks a checkout HMAC but never fetches the gateway payment status, amount, or currency; it permits a missing stored order ID. | A signed response is treated as captured payment without independent confirmation. |
| P0 | `api/payment/create-order/route.ts` creates a new gateway order on every call and ignores both payment-insert and commission-update failures. | Repeated clicks/concurrent requests can leave orphan orders and return an order that is not stored on the commission. |
| P1 | `api/media/sign-upload/route.ts` issues an unauthenticated Cloudinary upload signature; `api/media/upload/route.ts` is public without rate limiting. `CommissionForm` promises a safe reference upload but Cloudinary URLs are public. | Storage abuse and exposure of potentially private reference art. Private delivery cannot safely use this path. |
| P1 | `api/commission/route.ts` treats any unique-key violation as a successful idempotent retry, does not return the inserted request ID, and trusts client-provided image URLs/public IDs. | False success for unrelated uniqueness conflicts; no stable request reference; possible cross-upload deletion on failure. |
| P1 | `api/admin/approve/route.ts` builds a checkout link from the request `Origin` if site URL is unset, and interpolates an unescaped customer name into HTML email. `api/admin/reject/route.ts` interpolates name/reason. | Untrusted link target and HTML injection in outbound email. |
| P1 | `api/payment/webhook/route.ts` treated `refund.created` and partial refunds as fully `refunded`. | A pending or partial refund was shown as a completed full refund. |
| P1 | `types/supabase.ts` contains `commissions.public_id`, while no migration adds it. | Type/schema drift; uploaded objects cannot be reliably correlated to records. |
| P2 | `CommissionForm` retries all errors (including 400/429) three times; `deadline` only has a string length check; success has no request reference. | Unnecessary requests, confusing failures, invalid past deadlines, no way to cite an inquiry. |
| P2 | Admin queue has no pagination and swallows fetch failures into an empty queue. | Growing result cost and misleading empty state. |

## Existing state machine versus intended lifecycle

| From | To | Actor / route | Data and effects | Observed enforcement |
| --- | --- | --- | --- | --- |
| none | pending | anonymous visitor, `/api/commission` | validated inquiry; optional email | IP rate limit + server insert; no customer identity |
| pending | approved | admin, `/api/admin/approve` | INR quote, 24-hour bearer link, audit/email | session/API key + conditional status update |
| pending | rejected | admin, `/api/admin/reject` | reason, audit/email | session/API key + conditional status update |
| approved | payment_pending | bearer holder, `/api/payment/create-order` | Razorpay order and payment row | token/expiry checked; persistence errors ignored before fix |
| approved, payment_pending, or expired issued order | paid | checkout verifier or signed webhook | payment IDs, audit, revoke token | verifier now fetches captured payment, checks amount/currency/order; webhook checks signed captured event |
| approved or payment_pending | expired | checkout/cron | expiry | expiry checked, some writes not state-conditional |
| paid | fulfilled | no implemented route | none | schema/type only |
| any | cancelled | no implemented route | none | schema/type only |
| paid | refunded | no commission status | payment row updated from webhook | no refund initiation/policy; partial refund not distinguished |

The code has no supported clarification, revision, preview, progress, delivery, or customer acceptance transitions. Adding those safely requires customer identity or possession-based access design, private storage, and a product agreement covering revisions, rights, cancellation, and refund rules. We will not invent those business policies or create parallel customer/artist systems.

## Minimal implementation plan for this execution

1. Secure the existing request-through-payment vertical slice first: validate stored orders against gateway payment state and amount; make order initiation idempotent at the commission record; fail on persistence errors.
2. Close the unused public signing route, bound anonymous upload abuse, prevent arbitrary Cloudinary cleanup, and align the persisted upload metadata with a versioned migration.
3. Return a stable inquiry ID and only regard a duplicate *idempotency key* as success; improve client retry/validation/confirmation. Escape email content and use a configured canonical site URL for payment links.
4. Correct refund event classification so only confirmed full refunds get terminal payment status; preserve partial/pending events in audit history.
5. Add route-level regression tests for these defects, then run lint, TypeScript, tests, build, and real-browser checks where possible.
6. Record all unimplemented lifecycle stages and external verification blockers honestly. No production payment, live database mutation, or unapproved refund will be attempted.

## Browser and database verification needed

Use an isolated Supabase project and Razorpay sandbox with separate visitor/admin sessions. Submit a request, retry the same key, refresh admin queue, approve, inspect the email link host, initiate checkout twice and confirm one stored order, verify failed/uncaptured and captured sandbox payments, and assert private admin data is inaccessible anonymously. Check desktop/mobile upload errors, form keyboard operation, and console. Apply migrations in a disposable database before any production rollout. Live credentials and test accounts are not present in the local project as inspected, so these remain external checks unless the environment supplies them.

## Risks and unresolved uncertainties

The production migration state, RLS behavior, Cloudinary account configuration, Resend delivery, and Razorpay sandbox behavior are not locally verifiable. Existing anonymous inquiry design cannot meet the requested account-owned customer/artist access rules. Cloudinary `secure_url` is public and therefore inappropriate for private references or final deliverables. A future full workflow needs product decisions and identity/private-storage groundwork, rather than merely adding status buttons.

## Implementation and validation outcome

Implemented the request-through-payment slice in the existing API/routes: strict duplicate-key comparison and stable request IDs; upload URL shape validation and migration for Cloudinary public IDs; past/impossible deadline rejection; clearer client retry/error/success states; removal of public upload signatures and upload rate/declared-size limits; canonical checkout-link origin and escaped customer text in HTML emails; retained gateway order on checkout retries with conditional attachment and payment-row failure handling; independent Razorpay payment fetch before marking paid; capture-after-expiry recording; conditional webhook update checks; and pending/partial/full refund event classification. Route tests now exercise submission retries, malformed references, upload signing closure, order retries, audit failure, invalid states, captured/uncaptured payment decisions, and refund classification. Real Chrome against the production build rendered `/commission` at 1440px and 390px, validated required fields, had no horizontal overflow, and reported zero browser console/runtime errors. Live submission, authenticated admin review, actual Cloudinary transfer, and payment sandbox remain unverified because the local environment has none of the required external credentials.

The requested complete multi-artist lifecycle remains **incomplete**. The implemented slice cannot be called a functioning customer-to-artist workflow: visitors have no account-owned history; quote acceptance is a bearer-link checkout rather than an explicit agreement; there is no clarification, work progress, revision, delivery, customer approval, or safe refund initiation. Anonymous upload remains public despite rate limiting and must be replaced by private storage before accepting confidential reference material. Payment-to-commission/audit writes are not a single database transaction, so reconciliation is required before production. Database migration application and RLS behavior need a disposable Supabase project, and Razorpay capture/webhook behavior needs test-mode credentials. No production payment or live database operation was performed.

Final local checks: `npm run lint` exited 0; `npx tsc --noEmit` exited 0 after clearing a malformed ignored `.next/dev/types` artifact and regenerating types; `npm test` passed 235/235 tests in 77 suites; `npm run build` exited 0 and generated 27 static pages. `git diff --check` exited 0. Headless Chrome verified the production-built form at desktop and mobile widths, required-field feedback, no horizontal overflow, and zero browser runtime/console errors. Browser screenshots were visually reviewed. No Supabase CLI, `psql`, project credentials, or test accounts are available locally, so migrations, RLS behavior, actual request persistence, signed Cloudinary delivery, Resend delivery, and Razorpay test-mode callbacks were not executed. Next.js also warns that a parent lockfile changes its inferred workspace root and that middleware convention is deprecated; these warnings did not fail the build.
