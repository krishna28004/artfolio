# Artfolio Safe Cleanup and Optimization Guide

This guide is designed to reduce project size safely without breaking local development or deployment.

Current size hotspots detected in this project:
- `node_modules/` ~682 MB
- `.next/` ~1.1 GB

These two folders are generated artifacts and should not be committed.

---

## 1) Safe Cleanup Plan

The following are safe to delete because they are generated, not source code:

1. `node_modules/`
   - Why safe: dependencies are restored from `package.json` + lockfile (`package-lock.json`) via `npm install`.
   - Risk if deleted: app will not run until reinstall is done.

2. `.next/`
   - Why safe: Next.js rebuilds this folder on `npm run dev` / `npm run build`.
   - Contains compiled output, cache, and build artifacts only.

3. `dist/` (if present)
   - Why safe: common build output folder recreated during build.

4. `build/` (if present)
   - Why safe: generated build folder, recreated when needed.

5. `coverage/` (if present)
   - Why safe: test report output only.

6. `*.tsbuildinfo`
   - Why safe: TypeScript incremental cache.

7. Package manager caches (optional)
   - `.npm/`, `.pnpm-store/`
   - Why safe: only cache; reinstall can recreate.

Do NOT delete these:
- `src/`, `public/`, `package.json`, `package-lock.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `.env` values you need.

---

## 2) .gitignore Setup (Applied)

The project `.gitignore` at `client/.gitignore` was updated to prevent future accidental commits of generated files.

It now ignores:
- `node_modules/`
- `.next/`
- `dist/`, `build/`, `coverage/`
- log files
- env local files
- cache/temp/editor files

This ensures only source code and required config are pushed to GitHub.

---

## 3) Deployment Safety Check (Vercel / similar)

Why local cleanup is safe for production:

1. CI/deployment platform clones your Git repository.
2. It reads `package.json` and lockfile.
3. It runs dependency install (`npm ci` or `npm install`).
4. It runs build command (`next build`).
5. It creates fresh build output (`.next/`) on the deployment server.

So deleting local `node_modules/` and `.next/` does NOT affect deployed production, as long as source + lockfile are correct.

---

## 4) Step-by-Step Cleanup Commands

Run from `client/`.

### 4.1 Optional: check size before cleanup

```bash
du -sh .next node_modules src public 2>/dev/null || true
```

### 4.2 Delete generated artifacts

```bash
rm -rf .next node_modules dist build coverage
rm -f *.tsbuildinfo
```

### 4.3 Reinstall dependencies

```bash
npm install
```

### 4.4 Verify local development and production build

```bash
npm run lint
npm run build
npm run dev
```

If lint fails but build succeeds, app can still deploy depending on CI rules. Keep CI rules consistent with your team policy.

---

## 5) Size Optimization Recommendations

1. Optimize images in `public/images/`
   - Convert heavy JPEG/PNG to WebP/AVIF.
   - Resize originals to realistic max dimensions before committing.

2. Remove duplicate assets
   - Keep one canonical file per artwork.
   - Use clear naming conventions to prevent duplicates.

3. Clean unused dependencies
   - Use `npm prune` to remove extraneous packages.
   - Periodically audit manually by checking imports vs `package.json`.

4. Avoid committing generated files
   - Keep `.gitignore` strict.
   - Review `git status` before commits.

5. Keep build caches local only
   - Never commit `.next/`, `coverage/`, temporary reports.

---

## 6) Failure Scenarios and How to Avoid Them

1. Deleting `.env` or required secrets by mistake
   - Avoid: back up `.env.local` before cleanup.

2. Deleting lockfile (`package-lock.json`) unintentionally
   - Avoid: never remove lockfile unless intentionally regenerating dependencies.

3. Committing large generated directories
   - Avoid: verify `.gitignore` and check `git status` before push.

4. App fails after reinstall due to Node version mismatch
   - Avoid: use same Node version in local and deployment.

5. Lint/TypeScript issues discovered after cleanup
   - Avoid: run `npm run build` and `npm run lint` before push.

6. Broken asset paths after image optimization
   - Avoid: keep filenames stable or update references immediately.

---

## 7) Verification Checklist

Before pushing to GitHub:

- [ ] `npm install` completed successfully
- [ ] `npm run build` passes
- [ ] `npm run dev` starts and key pages load
- [ ] API routes respond as expected
- [ ] No required env file was deleted
- [ ] `git status` does not include `node_modules/` or `.next/`
- [ ] Images and assets render correctly

Deployment readiness:

- [ ] `package-lock.json` committed
- [ ] `.gitignore` committed
- [ ] build command in platform is correct (`next build`)
- [ ] required env vars configured in deployment platform

---

## Practical Result You Should Expect

After cleanup, local folder size should drop significantly because `.next/` and `node_modules/` are usually the biggest contributors. Functionality remains intact after reinstall and rebuild.
