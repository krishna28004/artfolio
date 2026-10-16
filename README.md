# Artfolio

Artfolio is a single-artist portfolio for presenting Krishna Kumar's artwork through a public gallery, artwork detail pages, and an interactive virtual exhibition.

## What is in the project

- Public artwork catalog with dedicated artwork pages, saved works, and an accessible 2D exhibition alongside the 3D gallery.
- Private commission request, tracking, and curator workflows. Supabase Auth protects the Studio Portal and its administrative routes.
- Optional Razorpay checkout, Resend email, Cloudinary media, and Upstash rate limiting integrations.
- Commission intake and payments are release-gated and default to disabled. Keep both `ARTFOLIO_COMMISSIONS_ENABLED` and `ARTFOLIO_PAYMENTS_ENABLED` set to `false` until the release checklist is satisfied.

The repository contains working application code and local verification, but those checks do not establish that external Supabase, email, storage, or payment settings are ready. See the current [commission release checklist](docs/commissions/RELEASE_CHECKLIST.md) and [Supabase operations notes](docs/supabase/REHEARSAL_RUNBOOK.md) before changing hosted systems.

## Technology

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS
- Three.js, React Three Fiber, and Drei for the virtual exhibition
- Supabase Auth, Postgres, and Storage
- Razorpay, Resend, Cloudinary, and Upstash Redis integrations
- Node's built-in test runner and ESLint

## Application map

| Route | Purpose |
| --- | --- |
| `/` | Portfolio homepage |
| `/artworks` | Complete artwork gallery |
| `/artwork/[id]` | Artwork details |
| `/saved` | Saved artwork collection |
| `/exhibition` | Interactive 3D exhibition |
| `/exhibition/accessible` | Accessible 2D exhibition |
| `/commission` | Commission request form |
| `/commission/track/[id]` | Private commission tracking |
| `/admin/login` | Curator sign-in |
| `/admin` | Studio dashboard and admin sections |

The main code is under `src/app`, reusable components under `src/components`, artwork and commission features under `src/features`, database migrations under `supabase/migrations`, and automated checks under `tests`.

## Local development

Use a Node.js release supported by Next.js 16 and npm. Install dependencies from the lockfile, then start the development server:

```sh
git clone https://github.com/krishna28004/artfolio.git
cd artfolio
npm ci
```

Create `.env.local` from the safe variable-name template and fill only credentials for services you intend to test:

```sh
cp .env.example .env.local
npm run dev
```

PowerShell equivalent for the copy step:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Never commit `.env.local`; keep Supabase service-role, admin, payment, email, storage, and cron credentials server-side. `NEXT_PUBLIC_*` variables are exposed to browser code. Local pages and mocked tests may work without every optional provider configured; provider-backed flows need their own test credentials.

`.env.example` contains placeholders only. Set both release flags to `false` for local setup. Do not put production values in local test configuration.

## Checks

Run the repository's available checks from the project root:

```sh
npm run lint
npm test
npx tsc --noEmit --incremental false
npm run build
```

The test command uses Node's test runner and local fixtures/mocks. A passing local suite does not verify hosted authorization policies, email delivery, storage access, payment callbacks, or database recovery. The production build may require valid local environment configuration; use loopback-only fixtures for build verification and keep commission/payment flags off.

## Supabase and release safety

SQL migrations live in `supabase/migrations` and are numbered in application order. The current rehearsal and production projects have already received their reviewed migration sets through the Supabase SQL Editor. That method did not record the corresponding CLI migration versions, so do not replay the bundle or run `db push`/`db reset` against either existing project. Reconcile the execution ledger and actual schema before any later database deployment. Read [the rehearsal runbook](docs/supabase/REHEARSAL_RUNBOOK.md), [the recovery workflow](docs/supabase/RECOVERY_WORKFLOW.md), and [the security review](docs/supabase/SECURITY_REVIEW.md) first.

The production snapshot described in those notes is partial and has no tested restore path. The commission and payment release flags remain disabled. This repository does not itself change hosting variables, deploy the app, or enable payments.

## Deployment

The app uses standard Next.js build and start commands. Hosting configuration and deployed environment variables are managed outside this repository. Before deploying, review the commission release checklist, configure secrets in the hosting provider, confirm the intended Git branch and Supabase project, and validate the matching Preview environment. Do not use a production service-role key in a client-side variable.

## Documentation

- [Commission release checklist](docs/commissions/RELEASE_CHECKLIST.md)
- [Supabase rehearsal runbook](docs/supabase/REHEARSAL_RUNBOOK.md)
- [Supabase recovery workflow](docs/supabase/RECOVERY_WORKFLOW.md)
- [Supabase security review](docs/supabase/SECURITY_REVIEW.md)
- [Migration readiness checklist](supabase/verification/PRE_MIGRATION_READINESS_CHECKLIST.md)
- [Rehearsal guide](supabase/verification/REHEARSAL_GUIDE.md)
- [Historical audits and checkpoints](docs/archive/README.md)

## License

Artfolio is released under the [MIT License](LICENSE).
