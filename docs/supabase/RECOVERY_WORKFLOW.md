# Artfolio rehearsal recovery workflow

**16 October 2026 update:** This document records the earlier 11-migration preparation state. The separate rehearsal project now has all 15 migrations applied, including two forward patches. With explicit approval, the confirmed production project's `main` branch received the 11 pending migrations in one guarded SQL Editor transaction. A read-only post-check confirmed the coordinate fix, closure of legacy-table access, and preserved row counts. SQL Editor left migration history at the original four recorded versions; do not fabricate history or replay the bundle. The owner waived the backup/restore gate for the disposable rehearsal project and the paid/scheduled-backup requirement for production. A local export of production's eight public tables was captured with a SHA-256 manifest outside this repository; it is only a partial snapshot, without Auth, Storage objects/configuration, roles, or a restore test. Do not use older bundles or fresh-project instructions to replay migrations on either existing project.

**Status:** The rehearsal and approved production migrations described above have already been applied. The capture and restore steps below are retained for future recovery planning; they are not instructions to rerun migrations or recreate either existing project. Production has only a partial SQL snapshot and no tested restore path. Keep `ARTFOLIO_COMMISSIONS_ENABLED=false` and `ARTFOLIO_PAYMENTS_ENABLED=false`.

## Current local baseline

- The reviewed 11-file bundle at `C:\Users\user\Documents\Codex\2026-10-13\lo\work\artfolio-rehearsal-20261014-readiness-v2.sql` matches `scripts/prepare-rehearsal-sql.mjs` byte for byte; its SHA-256 is `95edbd046829b6b481a1ab16052dd0c339e71948feaefc0cc1878cb6ec27a828`. Its adjacent source manifest also matches. Neither artifact is a database backup.
- The offline rehearsal preflight passes. It checks configuration format, separation from the main URL, and both commission/payment flags set to `false`; it cannot prove Dashboard ownership, branch selection, remote privileges, or empty data.
- Supabase CLI 2.120.0 was installed in an isolated tools directory under `C:\Users\user\Documents\Codex\2026-10-13\lo\tools\supabase-cli`. Its local `db dump --help` confirms `--db-url`, `--file`, `--role-only`, `--data-only`, `--use-copy`, `--exclude`, and `--schema`. The CLI uses a container for `pg_dump`, so a working Docker-compatible engine is required for these commands. Docker and `psql` are not installed on PATH. PostgreSQL `psql` is needed for a later restore drill, not the dump itself.
- Windows 10 Pro 22H2 build 19045 on x64, PowerShell 7.6.5, Node 24.13.0, npm 11.6.2, and WSL 3.0.3 were observed locally. The WSL status query was denied; hardware virtualization and RAM queries were also denied. Docker Desktop, `psql`, and `pg_dump` were absent from PATH, and Docker Desktop was absent from the normal install path and installed-program registry list. The C: drive had about 20 GiB free at inspection; recheck before any container setup. Docker Desktop installation is deferred because it changes machine state and requires separate approval and licensing/prerequisite review. Choose a `psql` major version after independently confirming the rehearsal database version.

## Local tooling gate

Before requesting Docker installation, have the machine owner check **Task Manager → Performance → CPU → Virtualization**, **Task Manager → Performance → Memory** for installed RAM, **Settings → System → About** for build/edition, and `wsl --status` in their own PowerShell session. Record only prerequisites, not account data. Confirm current Docker Desktop Windows requirements and licensing for this machine, then seek separate approval for its installer, any WSL/Windows feature changes, admin prompt, restart and disk use. Do not install a PostgreSQL client until the rehearsal server major version is read under separate authorization; then install the matching official client with user-approved scope. A local `psql` is for the isolated restore drill. No Docker engine, container, or remote connection was started by this preparation.

The in-memory SQL fixture imports the optional `@electric-sql/pglite` runtime through `PGLITE_MODULE_PATH`; it is not declared in Artfolio's manifest or lockfile. If package-registry access is later allowed, install a reviewed pinned version into an isolated tools folder and point `PGLITE_MODULE_PATH` to its module entry; do not add it to application runtime dependencies. Until it is available, PostgreSQL simulation is **BLOCKED** rather than passed.

## Gates before any remote read

1. In the Supabase Dashboard project list, open `artfolio-rehearsal`. In Settings → General privately compare the exact reference with the ignored test configuration and confirm it differs from the main Artfolio project. Confirm the selected branch is `main` and investigate why it is labelled `PRODUCTION` within this separate project. Record owner approval that this exact target is disposable. Recheck the selected project and branch immediately before every SQL section or export.
2. For a future database operation, obtain separate authorization for a fresh read-only inventory. Execute the seven metadata sections in `../../supabase/verification/PRE_MIGRATION_READINESS_CHECKLIST.md` one at a time after rechecking the Dashboard selector: object/history existence; ACLs/defaults; effective grants; RLS/policies; Auth/Storage structure and execution-role privileges; three-bucket metadata/counts; and publication/placement aggregates only if the named columns exist. Stop on unexpected objects, history, grants, Auth columns, buckets or objects. The original `pre-migration-inventory.sql` is read-only but returns full policy expressions, which may contain literals; retain that output privately.
3. Record whether `supabase_migrations.schema_migrations` actually exists and the recorded versions. A file version does not prove that the hosted SQL bytes match locally edited historical files. Record zero counts explicitly; a blank Dashboard view is not evidence of zero data.
4. Obtain separate approval for **recovery capture** only after the target and read-only inventory have been reviewed. A capture is a read operation against the remote database and Storage API. It does not modify source data, but its output can contain sensitive rows and file bytes.

## Future approved database capture

Create a unique timestamped folder outside the Artfolio repository. `prepare-rehearsal-capture.mjs` requires `capture-YYYYMMDD-HHMMSS`, refuses an existing folder and a parent resolving inside the repository, writes a self-ignoring `.gitignore`, and creates incomplete metadata templates. Check `git check-ignore` from any containing Git worktree before placing private captures there. Use a private local volume, restrict access, and encrypt any off-machine copy. Do not put a database URL or key in these JSON files.

```powershell
$captureParent = Join-Path $env:USERPROFILE 'Documents\ArtfolioRehearsalCaptures'
New-Item -ItemType Directory -Path $captureParent -Force | Out-Null
$captureDir = Join-Path $captureParent ('capture-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
node scripts/prepare-rehearsal-capture.mjs --output-dir $captureDir
```

After separate capture approval, copy the **rehearsal** database connection string from that project's Dashboard → Connect (session pooler by default). Disable clipboard history/sync before copying. In a private PowerShell session, load it directly from the clipboard and clear the clipboard; do not paste it into a command, prompt, source file or chat. A process environment variable is temporary but can be read by child processes, and `--db-url` may be visible to local process inspection while the CLI runs. Close the shell or remove the variable afterward.

```powershell
$env:ARTFOLIO_REHEARSAL_DB_URL = (Get-Clipboard -Raw).Trim()
Set-Clipboard -Value ''
if ([string]::IsNullOrWhiteSpace($env:ARTFOLIO_REHEARSAL_DB_URL)) { throw 'Rehearsal DB URL was not loaded' }
```

Privately compare the project reference encoded in the session-pooler username (`postgres.<reference>`) or direct host (`db.<reference>.supabase.com`) with the Dashboard reference and the ignored rehearsal configuration. Confirm the Dashboard branch again. Do not use a previously linked CLI project as identity evidence. The commands below are **reserved for later approval**; they were not run during this preparation task. The installed CLI's `db dump --help` was checked locally. Docker must be running. Do not use `--debug` or retain raw CLI error logs that may contain the connection string. On any nonzero exit, stop and mark the capture incomplete.

```powershell
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$cli = 'C:\Users\user\Documents\Codex\2026-10-13\lo\tools\supabase-cli\node_modules\.bin\supabase.cmd'
if ($historyExists -isnot [bool]) { throw 'Set historyExists from the approved read-only inventory first' }
try {
  & $cli db dump --db-url "$env:ARTFOLIO_REHEARSAL_DB_URL" --file "$captureDir\roles.sql" --role-only *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Role export failed; capture incomplete' }
  & $cli db dump --db-url "$env:ARTFOLIO_REHEARSAL_DB_URL" --file "$captureDir\schema.sql" *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Schema export failed; capture incomplete' }
  & $cli db dump --db-url "$env:ARTFOLIO_REHEARSAL_DB_URL" --file "$captureDir\data.sql" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes *> $null
  if ($LASTEXITCODE -ne 0) { throw 'Data export failed; capture incomplete' }
  if ($historyExists) {
    & $cli db dump --db-url "$env:ARTFOLIO_REHEARSAL_DB_URL" --file "$captureDir\history_schema.sql" --schema supabase_migrations *> $null
    if ($LASTEXITCODE -ne 0) { throw 'History schema export failed; capture incomplete' }
    & $cli db dump --db-url "$env:ARTFOLIO_REHEARSAL_DB_URL" --file "$captureDir\history_data.sql" --use-copy --data-only --schema supabase_migrations *> $null
    if ($LASTEXITCODE -ne 0) { throw 'History data export failed; capture incomplete' }
  }
} finally { Remove-Item Env:ARTFOLIO_REHEARSAL_DB_URL -ErrorAction SilentlyContinue }
```

The first three commands follow Supabase's CLI logical backup guide. The last two export actual migration history separately **only when the read-only inventory found that table**. If the table is absent, omit those two commands, set `target-project.json`'s `migrationHistoryExists` to `false`, and record the read-only absence result with project reference and UTC time in `history-absence.json`; do not invent rows. If any command fails, stop and mark the capture incomplete. The regular schema dump excludes Supabase-managed schemas such as `auth` and `storage` by default. Review data-dump table coverage privately; do not assume hosted Auth/Storage customizations, extension objects, signing keys, role passwords, or Dashboard configuration were captured. Grants and default privileges may restore differently in a new project. A database dump never contains Storage file bytes. Use the official [backup and restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) and [CLI reference](https://supabase.com/docs/reference/cli/supabase-db-dump) when planning the restore.

## Storage and hosted configuration

The repository uses `artworks-public`, `artworks-private`, and `commission-private` (references **and** deliverables). Populate `storage-inventory.json` from the approved read-only bucket/count query, including absent buckets as `exists: false`, `objectCount: 0`; record bucket visibility, MIME and size rules privately. Set `policiesReviewed` only after examining Storage RLS/policies and effective permissions, including when no bucket exists. For an existing bucket, set `restrictionsReviewed` only after confirming its size and MIME settings; `null` means the confirmed setting is unrestricted, not unknown. Preserve the underlying review evidence separately. If every bucket is empty, record the exact target reference, branch, UTC time and zero counts; no file-byte export is needed for that baseline. If any object exists, stop until a separately reviewed export captures its bytes and an encrypted remote-path map without making private buckets public. CLI 2.120.0 locally documents `storage ls --project-ref --recursive` and `storage cp --project-ref --recursive`; their remote behavior and access scope must be verified in the separate capture approval. Compare exported file counts and SHA-256 with the inventory. Protect private files and never print object paths in reports. See Supabase's [Storage download guidance](https://supabase.com/docs/guides/storage/management/download-objects).

Populate `hosted-config.json` with review-complete booleans only after privately recording Auth providers, signup/recovery, redirect URLs, email templates/limits, MFA/session settings, Edge Functions, secret **presence**, schedules and webhooks. Do not copy factor seeds, user passwords, JWT signing keys, API credentials or secret values into ordinary artifacts. Record the source project's version and any nondefault extensions/publications for the restore plan.

## Artifact verification and restore drill

Fill `target-project.json`, `tool-versions.json`, `storage-inventory.json`, and `hosted-config.json` with factual results. Keep the pre-generated `migration-source-manifest.json`. The local verifier requires the three main SQL exports, actual history dumps **or** recorded absence, exact source migration hashes/order, the three bucket inventory, sanitized configuration evidence, and Storage file hashes if object counts are nonzero. It does not print SQL contents, connection strings, private paths or metadata values. Create its one-time SHA-256 manifest only after all files are present; the script refuses to overwrite an existing manifest. A local manifest is not cryptographically authenticated: store a protected copy of its hash outside the capture if tamper evidence against a malicious editor is required.

```powershell
node scripts/verify-rehearsal-capture.mjs --dir $captureDir --create-manifest
node scripts/verify-rehearsal-capture.mjs --dir $captureDir
```

`INTEGRITY VERIFIED; RESTORE NOT VERIFIED` means bytes and declared coverage match. The `migrationHistoryAlignment` field compares captured version **sets** with the 11 source filenames; `RECONCILIATION REQUIRED` stops migration planning even when the capture itself is intact. COPY row order is not proof of application order, and a matching version set does not prove matching SQL bytes. Before sealing, the verifier requires a PostgreSQL dump-completion line at the end of every SQL export; if the installed CLI emits a different legitimate ending, stop and inspect the exact output format before changing this check. A completion line and a zero CLI exit do not independently prove that every intended table or row was captured. Compare the approved source inventory against dump object lists and row counts privately. Database SQL exports can include personal data, customer rows and private artwork metadata: restrict access to the whole capture, do not attach dumps to reports, and never log their contents. Hashes do **not** prove that SQL applies cleanly or that hosted services can recover. An incomplete or tampered capture exits nonzero. Store the restore-drill evidence separately so the capture can be verified against its original manifest.

After separate approval, restore into a **different isolated disposable target**, never the source rehearsal project or main Artfolio project. Prefer a local Supabase stack only after reviewing Docker image provenance, published ports, local data directory and cleanup behavior. Recreate required extensions, apply roles/schema/data and actual history through a reviewed `psql --single-transaction --set ON_ERROR_STOP=1` procedure based on the official guide; never replay the 11 migrations on top of restored schema. Compare tables, constraints, sequences, function owners/search paths, grants, default privileges, RLS and Storage policies; compare counts and representative non-sensitive queries. Restore any Storage bytes with their private paths and hashes, then exercise anonymous, customer A/B and owner access with synthetic data. Local Auth/Storage services cannot prove all hosted provider settings. Record actual commands, target, errors, object comparisons and elapsed recovery time. **Do not mark the restore gate passed until this drill succeeds and its limitations are reviewed.** A second hosted project or paid service needs separate approval.

## Migration decision after recovery is proven

- **Genuinely empty** public application schema, no conflicting views/functions/history/Storage objects, correct Auth/Storage schema and execution role, and approved recovery evidence: review the exact guarded 11-file bundle and seek separate permission for one atomic rehearsal application. The guard alone checks only public tables and selected Auth/Storage prerequisites; the seven-part inventory supplies the missing checks. Early permissive policies must remain inside the reviewed transaction until final hardening is committed.
- **Existing objects or history:** stop. Compare hosted versions and actual schema with the source hashes and inventory. Prepare a forward-only repair for the observed state; do not replay historical files.
- **History disagrees with schema:** stop. If SQL Editor was used, record its actual execution, bundle hash, source hashes, project/branch, operator, timestamp and post-application schema in a deployment ledger. SQL Editor does not register 11 CLI history rows. Never fabricate records or use `migration repair`, `db push`, or `db reset` to force agreement.
- **Unexpected grants, bucket contents, required Auth columns or publication state:** stop for a reviewed reconciliation plan. `set_exhibition_publication(true, ...)` currently clears stored `position_3d` and `rotation_3d`; the local regression reproduces that loss. The proposed forward correction clears only the active `wall_identifier` and preserves coordinates. Do not call that function remotely until corrected or explicitly accepted for disposable testing.

Remote migrations, real commissions and payments remain **NO-GO** until inventory, capture, restore, migration reconciliation, Storage and Auth checks, and sandbox integrations pass under separate approvals.
