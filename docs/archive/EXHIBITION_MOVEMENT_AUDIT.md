# Exhibition movement audit and implementation plan

## Architecture inspected before implementation

`src/app/exhibition/page.tsx` owns entry, artwork focus, detail-modal and pointer-lock UI state. It renders `GalleryScene`, which creates the R3F Canvas and six-room museum. The live controller is `Controls.tsx`; `FirstPersonController.tsx` is not mounted or imported by this scene. There is one live `useFrame` movement loop.

Keyboard listeners and HTML/mobile controls write shared input state. The controller projects camera forward onto XZ, combines keyboard and joystick directions, limits diagonal speed, exponentially damps velocity, and passes requested motion to `physics/collision.ts`. That engine uses bounded-distance substeps, iterative circle/AABB penetration resolution, and inward-normal velocity projection for sliding. It is substepped continuous collision rather than an analytic time-of-impact sweep. Resolved X/Z are written to the camera; Y is eye height plus optional head bob. There is no separate ground-position state.

Physical colliders are an explicit list of museum walls and four benches. Artwork/frame/floor/ceiling meshes do not enter this list. Artwork targeting uses proximity, view direction and line-of-sight, and calls the page's focus callback. Artwork clicks and the page's inspect controls open the detail modal. Floor taps/double clicks set a walk-to target. Pointer lock changes event raycasting to the viewport center. Mobile joystick and independent touch-look use the same controller and collision engine.

## Confirmed reset root cause

At the pre-fix `GalleryScene.tsx:414-416`, every render creates a fresh `initialSpawn` tuple. `Controls.tsx:114-201` combines keyboard-listener setup with `camera.position.set(initialPosition[0], initialPosition[1], initialPosition[2])`; its effect depends on the tuple object, `[initialPosition]`.

Artwork proximity changes call `onFocusArtwork` -> page `setFocusedArtwork` -> scene rerender -> new tuple identity -> effect cleanup clears inputs -> effect setup writes spawn again. Modal state, pointer-lock UI state and adaptive DPR updates can also cause the same reset. Ordinary wall contact itself does not return spawn: approaching wall-mounted artwork makes this lifecycle bug appear to be a collision bug.

**Executed reproduction before implementation edits:** `tests/exhibition-controller.test.ts` executes the actual transpiled Controls component using real React DOM effects, a real Three camera, JSDOM event listeners and the production collision engine (renderer hooks/catalog only are substituted). Holding backward for 180 frames reaches the legal south-wall boundary Z=29.5. Rerendering with an equivalent fresh spawn tuple fails the preservation assertion: **`Reset from 29.5 to 27`**. This directly demonstrates the unexpected reset; it is not a finiteness-only test. Node initially hit sandbox `spawn EPERM`; the reproduction ran outside that sandbox and failed as expected.

The installed R3F source also inspects Canvas camera configuration when configuring the renderer. Stabilize camera options as well, without assuming every new options object replaces an existing camera. Keep Controls outside asset Suspense so artwork/environment loading cannot unnecessarily suspend its lifecycle. Keep a scene-owned pose ref to restore pose if the controller or camera is replaced within the current visit.

## Related confirmed defects and limits

- Blur/hidden/unlock clear key flags but leave walk-to active and velocity nonzero; the visitor can coast or resume automatic walking.
- Modal opening does not clear the controller's key Set immediately; keys can survive a missed keyup. Modal transitions should clear all inputs and velocity while preserving pose.
- Normalizing every nonzero combined input makes partial joystick deflections travel at full speed.
- `Math.min(delta, .05)` accepts negative/NaN frame times. Invalid velocity can propagate; infinite displacement can make collision substeps unbounded. The collision engine has no reference to spawn and cannot independently recover corrupt position.
- Mobile reset clears global sprint but leaves the rendered sprint toggle enabled, and modal reset does not reset the joystick's visual state.
- Proximity-triggered automatic orientation alignment can resume after manual look and change the visitor's viewing direction. Targeting should report focus without steering the camera.
- The legacy hall uses museum line-of-sight geometry despite its different layout; apply museum occlusion only in museum mode.
- Physical wall/door coordinates are hardcoded in both rendered shell and collision list. Current doorway traversal tests cover all eight openings in both directions. Radius is 0.35m, default step distance 0.12m; configured openings have positive clearance for the 0.7m player diameter. Do not expand bounds or introduce artwork blockers.
- Three PointerLockControls is not used by the live controller. The reported THREE message matches the older committed Controls implementation, which used DreiPointerLockControls; the existing user changes already replaced it with the custom safe helper. The exact historical browser failure cannot be reproduced from a console excerpt alone. User-gesture denial is a separate browser API failure; the safe-request helper catches exceptions, but clears pending too early for asynchronous void-returning APIs. It has no position write and cannot directly teleport a visitor. The lock UI rerender can trigger the confirmed spawn effect.

## Minimal implementation plan (recorded before implementation changes)

1. Separate one-time/pose-restoring camera initialization from input listener lifetime. Ignore spawn tuple identity after initial entry; preserve scene-owned last finite pose through controller replacement. Memoize scene spawn/camera configuration and keep the controller outside asset Suspense.
2. Retain the existing velocity and collision pipeline. Guard frame times, inputs, velocity, orientation and positions; recover to the last valid pose, never spawn. Reject invalid collision arguments explicitly and stop invalid velocity at the current valid position. Keep substepping, sliding and existing physical obstacles.
3. Clear keyboard, shared movement, walk-to, velocity and touch deltas on modal lifecycle, blur, hidden and unlock. Preserve camera pose. Honor analog joystick magnitude and remove automatic artwork camera steering. Keep mouse/touch look explicit and finite.
4. Keep pointer-lock requests in existing click handlers; retain nonfatal rejection/unsupported behavior, protect asynchronous legacy requests until lock/error events and clean up pending listeners. Synchronize mobile sprint and joystick visuals during resets.
5. Extend existing deterministic collision tests and add actual React controller/mobile lifecycle tests. Wire them into the existing npm test command. Do not weaken existing assertions or alter unrelated application features.

## Files/functions expected to change

- `Controls.tsx`: initialization, input cleanup, pointer lifecycle, useFrame movement/targeting/recovery.
- `GalleryScene.tsx`: stable spawn/camera configuration, scene pose ref, controller placement.
- `physics/collision.ts`: finite argument guards, overlap recovery and safe iteration behavior if tests demonstrate a problem.
- `controllers/pointer-lock-manager.ts`: pending lifecycle for void-return APIs.
- `MobileControls.tsx`: reset visuals and sprint state.
- Existing collision/pointer tests, new controller/mobile lifecycle regression tests and package test script.

## Regression and browser verification plan

Deterministic tests must assert non-spawn positions after wall contact and artwork focus rerenders, sliding and retreat from the last boundary, both X/Z signs, corners, initial overlap, zero motion, doorways, sprint and frame spikes. Actual React lifecycle tests must cover modal round trips, changed spawn tuple identity, controller remount pose restoration, keyboard/blur/visibility cleanup, invalid input recovery, desktop and concurrent touch movement/look. Pointer tests must cover promise denial and delayed void APIs without duplicate requests. Mobile DOM tests must exercise independent pointer IDs, cancellation and sprint reset.

Real browser checklist: enter; head-on/diagonal wall contact and sliding; four artwork wall orientations; inspect/close/continue with unchanged pose; all doorways and room changes; corners/retreat; sprint collision; Escape and explicit resume click; denial/unsupported lock; portrait/landscape joystick plus touch-look; mobile modal; background/return; console runtime errors. Check distance from spawn after each interaction, not merely finite coordinates.

## Risks and unresolved uncertainties

No browser automation tool is exposed in this session; inspect installed tooling before declaring browser verification unavailable. JSDOM cannot prove WebGL rendering, browser pointer-lock permissions, true multitouch capture, responsive layout or GPU timing. It can execute actual React control lifecycles and camera mathematics. Production verification still depends on browser testing if no automation is available. New guards must not regress normal doorway clearance, anti-tunneling or tangential movement. Scene pose persistence lasts for a mounted visit; a deliberate full page re-entry initializes a new visit. Existing user changes were present in package/page/modal/controllers/touch/tests at task start and must remain intact. No commit or push is authorized.

## Additional defects reproduced during implementation

Additional reproduced lifecycle defect: with the actual React controller, start a void-returning pointer-lock request, open the modal before it completes, then emit the delayed lock-change event. The new regression failed with `Late lock must be released while artwork details are open` (exit count 0 instead of 1). The modal-open effect cannot exit a lock that does not yet exist, and the lock-change handler previously accepted this late lock. Plan: reject/release acquired locks in that handler while the modal ref is active, without changing camera pose. This is separate from the spawn-reset root cause.

Browser-discovered resume-control defect: after closing artwork details while the artwork remains focused, the desktop look control is absent. `src/app/exhibition/page.tsx` gates the entire hint/control block on `!focusedArtwork && !showHUD`. A real-browser attempt to click the explicit resume control failed with `Missing control: [aria-label="Click to look around with mouse"]`. Plan: keep that existing block available while an artwork is focused, suppress it while the modal itself is open, and retain the existing touch-HUD behavior. This requires only a condition change in the exhibition page, preserving its other existing user edits.

Additional input-priority defect: the walk-to branch returns before consuming joystick or already-held keyboard input. Keyboard cancellation previously depended on a new keydown event; joystick movement never canceled automatic navigation. Two actual-controller regressions (held backward keyboard input and backward joystick versus a northbound floor target) failed because `walkToTarget.active` stayed true and manual input was ignored. Plan: cancel the automatic target at the start of the existing frame pipeline when manual keyboard/shared-button/joystick movement is present. Touch-look alone remains independent and does not cancel walking.

## Implemented corrections

| File | Correction |
| --- | --- |
| `src/components/exhibition/Controls.tsx` | Separate initial/restored visit pose from input-listener setup. Keep the last finite legal position and orientation. Clear velocity, held keys, shared inputs and automatic targets on modal/blur/hidden/unlock. Validate frame/input/orientation data. Preserve analog magnitude, give manual movement priority, remove artwork-driven camera steering, use museum occlusion only in museum mode, prevent duplicate raycasting-compute replacement, release late pointer locks over modals. |
| `src/components/exhibition/GalleryScene.tsx` | Memoize spawn and Canvas camera options, own the visit pose ref, mount the existing controller outside asset Suspense. |
| `src/components/exhibition/physics/collision.ts` | Reject invalid position/configuration explicitly; stop invalid/overflowing or unrealistic motion at the current position. Prevent unbounded iteration from corrupt numbers, stop substeps once velocity is zero, reject nonfinite walkability inputs. Keep existing obstacle coordinates, radius, substeps and sliding. |
| `src/components/exhibition/controllers/pointer-lock-manager.ts` | Keep asynchronous void-return requests pending until a lock/error event or bounded timeout; clean up listeners and pending state safely. |
| `src/components/exhibition/MobileControls.tsx` | Synchronize rendered sprint/joystick flags with modal and focus-loss resets; preserve independent pointer channels. |
| `src/app/exhibition/page.tsx` | Preserve the explicit desktop resume-look control when artwork remains focused after a modal closes. This task changes only that condition in the existing user-edited page. |
| `tests/collision.test.ts`, `tests/pointer-lock.test.ts` | Add signed collision/contact/retreat, invalid-value and asynchronous legacy lock regressions without changing existing assertions. |
| `tests/exhibition-controller.test.ts` | Add 21 actual React/controller/mobile-DOM tests: non-spawn positions, real focus rerenders, modal/remount pose preservation, cleanup, invalid data, analog input, sprint/diagonals/FPS, artwork on three wall orientations, late lock, manual priority, locked mouse-look pitch and raycasting restoration. |
| `tests/exhibition-browser.mjs` | Add installed-Chrome/CDP desktop and native multitouch verification, with optional `--desktop-lifecycle` scenarios. No browser package installation or production debug endpoint. |
| `package.json` | Append the controller regression file to the existing npm test command, retaining all original test files. |

## Final executed validation

| Check | Actual result |
| --- | --- |
| `npm run lint` | Exit 0; ESLint completed with no errors or warnings. |
| `npx tsc --noEmit` | Exit 0; no diagnostics. |
| `npm test` | Exit 0; 220 tests, 77 suites, 220 passed, zero failed/cancelled/skipped/todo. Original 190 tests retained; 30 regressions added. |
| `npm run build` | Exit 0; compiled successfully, TypeScript completed, all 27 static pages generated, page optimization completed. Final build compilation reported 13.3s and TypeScript 10.4s; these are build timings, not browser performance measurements. |
| `git diff --check` | Exit 0; no whitespace errors. Git reports the existing LF/CRLF conversion notices. |

Final test summary:

```text
tests 220
suites 77
pass 220
fail 0
cancelled 0
skipped 0
todo 0
```

The initial test worker/dev-server launches were blocked by sandbox `spawn EPERM`; their authorized retries succeeded. The first sandbox build failed to download Inter and Playfair Display from Google Fonts; the network-enabled builds succeeded. No packages were installed or upgraded.

Remaining build/runtime warnings: Next infers the workspace root from a parent lockfile; middleware naming is deprecated; Supabase URL/anonymous-key configuration is absent, so catalog requests use the existing static fallback. Node prints the existing module-type warning for TS test files. Chrome prints a Three Clock deprecation warning. These did not fail the executed checks; live CMS behavior is not verified by the static fallback.

## Real-browser outcomes

Ran `npm run dev -- --port 3000` and the actual `/exhibition` page in installed headless Chrome via CDP. The completed default browser run exited 0 and passed:

- Entry at `[0, 1.65, 27]`, head-on south-wall boundary, diagonal sliding, retained non-spawn position and retreat.
- Sprint traversal through the entrance/main doorway.
- Artwork focus and desktop modal position/orientation preservation.
- Explicit API denial with an assertion that the request was actually invoked; no crash or pose change.
- Portrait 390x844 native two-touch joystick movement and independent look.
- Mobile modal pose preservation and sprint reset.
- Landscape 844x390 control bounds, viewport-resize pose preservation.
- Native tab switch/return preserving stopped position.

The optional `node tests/exhibition-browser.mjs --desktop-lifecycle` run exited 0 and additionally passed corner contact/retreat, sprint directly into a wall, west/east/north artwork wall approaches without spawn reset, an explicitly invoked rejected lock request and held-key tab cleanup. **Native granted pointer lock was not verified:** headless Chrome did not grant it, so its Escape/reacquisition branch was explicitly reported unverified, not passed. Actual controller DOM tests verify locked mouse-look mathematics, pitch clamp, duplicate lock events, centered raycasting and restoration on unlock using simulated lock state.

Successful browser runs recorded **zero uncaught runtime exceptions and `consoleErrors: []`**. Browser setup lowers raster DPR to 0.35 for software WebGL, emulates reduced motion, and emulates the fine-pointer media query only with zero touch points. It leaves production code, camera motion, collision logic and real DOM/touch events intact, and never fakes pointer-lock results. Consequently these runs establish interaction/movement behavior, not GPU performance or physical-device input detection. Early browser attempts timed out at higher software-rendering cost; fixture timing was also corrected to clear residual velocity before modal checks. Final exact pose assertions remain in place.

All eight doorways in both directions, doorway-edge clearance, the six-room route, corners, high-speed thin-wall containment and 1,000-step deterministic fuzzing passed the unit suite. Only entrance/main doorway traversal was performed as a continuous browser walk; the extra artwork-wall cases use controlled legal fixture starts.

### Remaining manual checklist

1. In normal desktop Chrome/Firefox, click the explicit look control, move the mouse, press Escape and click to resume; verify denial/unsupported behavior under actual browser permissions.
2. Traverse every room/doorway with normal graphics resolution and head bob enabled; sprint into corners, inspect/close artwork, continue from the same position and check the console.
3. On physical phone/tablet and hybrid input hardware, test portrait/landscape joystick plus look, cancellation, modal closure and background/return. Emulated touch does not prove real device capability detection or hardware performance.
4. Verify the live catalog with the intended Supabase configuration. Future museum layout changes must keep rendered walls/portals and the explicit collider list aligned.

## Git review and preservation

Branch: `main`. HEAD remains `9101da2d213145d2368e183bdbecd12b486196cb`. No commit, push, checkout, reset, project-file deletion, dependency installation or unrelated-page redesign was performed.

Existing user changes were present before this task in package/page/modal/controllers/touch/tests. Patches retain that work. `ArtworkDetailModal.tsx`, `FirstPersonController.tsx`, `touch/touch-controller.ts` and `tests/mobile-controls.test.ts` were not edited by this task. The existing page changes remain, with one resume-control condition changed. Existing custom pointer-lock and mobile input architecture were extended rather than replaced.

Final tracked modifications (including preexisting work):

```text
package.json
src/app/exhibition/page.tsx
src/components/exhibition/ArtworkDetailModal.tsx
src/components/exhibition/Controls.tsx
src/components/exhibition/FirstPersonController.tsx
src/components/exhibition/GalleryScene.tsx
src/components/exhibition/physics/collision.ts
tests/collision.test.ts
```

Final untracked files/directories (including preexisting work):

```text
EXHIBITION_MOVEMENT_AUDIT.md
src/components/exhibition/MobileControls.tsx
src/components/exhibition/controllers/
src/components/exhibition/touch/
tests/exhibition-browser.mjs
tests/exhibition-controller.test.ts
tests/mobile-controls.test.ts
tests/pointer-lock.test.ts
```

The local development server remains available at `http://localhost:3000/exhibition` for the normal-browser pointer-lock/manual checks.
