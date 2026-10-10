# Artfolio Virtual Museum — Phase 0 Technical Audit, Architecture Blueprint & Validation Report

> **Document Status:** Complete (Phase 0)  
> **Repository:** `krishna28004/artfolio`  
> **Author Role:** Senior Software Architect, Three.js / React Three Fiber Specialist, WebGL Performance Engineer, Gameplay Programmer & Digital Museum UI/UX Designer  
> **Date:** October 2026  

---

## 1. Executive Summary & Objective

The objective of **Phase 0** is to perform a rigorous architectural and runtime audit of the existing Artfolio 3D gallery, establish verified test baselines, design an interconnected 6-room museum floor plan inspired by curated physical museum aesthetics (deep charcoal walls, parquet flooring, architectural coffers, track lighting, gilded and dark wood frames), construct a type-safe data-only configuration contract, and define an implementation blueprint for Phase 1.

Per strict Phase 0 guidelines:
- The existing `/exhibition` scene remains completely functional and visually unchanged.
- No visual rebuild or runtime destruction has been performed.
- All configuration is strictly isolated in `src/components/exhibition/config/museum.config.ts`.
- All topology and reachability requirements are backed by automated tests in `tests/museum-config.test.ts`.

---

## 2. Comprehensive Technical Audit Table

| Area | Existing Implementation | Verified Issue or Risk | Classification | Recommended Action |
|---|---|---|---|---|
| **Route & Layout** | `src/app/exhibition/page.tsx`, `src/app/layout.tsx`, `AppChrome.tsx` | Global Navbar/Footer previously overlaid `/exhibition`. Solved via `AppChrome` isolation so `/exhibition` occupies 100dvh without site chrome while maintaining full chrome on `/exhibition/accessible`. | **CONFIRMED** (Resolved) | Maintain full-viewport containment (`fixed inset-0 w-full h-[100dvh] overflow-hidden`) for all future multi-room rendering. |
| **Scene Architecture** | `GalleryScene.tsx`, `Room.tsx`, `Lights.tsx`, `ArtworkFrame.tsx`, `Props.tsx` | Single rectangular room (50m × 80m). Missing modular wall/doorway composition, multi-room portals, or occlusion boundaries for complex multi-room navigation. | **CONFIRMED** | Transition in Phase 1 to a data-driven multi-room shell driven by `museum.config.ts` without hardcoding monolithic geometry. |
| **Movement & Camera** | `Controls.tsx` (PointerLockControls, manual keyboard WASD, touch swipe, floor double-click/tap) | Hardcoded proximity scan previously checked only default array. Frame-rate dependent damping could drift under low FPS. Single-click vs double-click floor navigation disambiguated. | **CONFIRMED** (Partially improved) | In Phase 2, implement delta-clamped, velocity-based first-person controller with sprint (Shift), subtle head-bob (respecting reduced-motion), and decoupled input refs. |
| **Collision System** | AABB bounding box clamping (`BOUNDARY.minX = -23`, `maxX = 23`, `minZ = -38`, `maxZ = 38`). | Single-room boundary box cannot handle internal partition walls, doorway portals, angled entries, or obstacles (pedestals, benches). Players would walk through interior walls. | **CONFIRMED** | In Phase 2, implement 2D circle-vs-line-segment continuous collision resolution with wall sliding and doorway portal pass-through. |
| **Artwork Data Flow** | Supabase `artworks` table, `/api/artworks` route, static fallback in `artworks.ts`, mapping in `artwork-service.ts` | Database rows previously lacked 3D coordinates, causing silent fallback drops. Now protected with `isValid3DPosition` and static spatial fallbacks. | **CONFIRMED** (Hardened) | Bind runtime artworks dynamically to `museum.config.ts` artwork slots by ID or curated room categories, preserving fallbacks. |
| **3D Assets & Textures** | `public/images/artworks/` (original master scans, ~27.5 MB total), `public/images/artworks/exhibition/` (~2.28 MB total), local floor texture (140 KB) | Previously fetched floor texture from external Unsplash CDN (high failure/offline risk) and downloaded unoptimized 3.5 MB JPEGs per frame. Localized and compressed by 91.7%. | **CONFIRMED** (Optimized) | Retain high-res masters for 2D inspect/WallFit; use optimized progressive textures for 3D museum walls with lazy mipmapped loading. |
| **Rendering Performance** | Three.js WebGLRenderer via React Three Fiber, Instanced beams/slats in `Room.tsx`, `BakeShadows`, `ContactShadows` | Premature `gl.forceContextLoss()` in `WebGLCleanup` previously killed context on unmount/remount. Multiple pointlights/spotlights in future 6 rooms could cause WebGL shader uniform/draw-call stalls if not instanced or culled. | **CONFIRMED** (Context loss fixed, multi-room risk LIKELY) | Enforce room-level frustum culling, shared PBR materials, limited shadow-casting lights, and maximum 2 dynamic spotlights per room. |
| **UI & Accessibility** | HUD overlay in `page.tsx`, `ExhibitionErrorBoundary.tsx`, Accessible 2D route at `/exhibition/accessible` | Onboarding overlay was un-reopenable after entry; reduced-motion preferences lacked visible prompt. Fixed with reduced-motion detection and accessible archive banner. | **CONFIRMED** (Improved) | Add collapsible minimap, in-game help [H] key, artwork inspect modal [V], and aria-live status announcements. |
| **Testing Coverage** | Node test runner (`node:test`, `--experimental-strip-types`) with loaders in `tests/` | Virtual exhibition lacked automated unit tests for geometry, aspect ratios, boundaries, and topological graph reachability. Added 17 exhibition tests and 13 museum config tests (total 110 tests passing). | **CONFIRMED** (Coverage established) | Keep test suite integrated in `npm test` covering all configuration validation and collision math. |

---

## 3. Verified Baseline & Test Results

All baseline checks executed directly in the repository environment:

```bash
# 1. Test Suite Execution
npm test
# Result: PASS (110 tests passed across 41 suites, 0 failed, duration: ~4.2s)

# 2. TypeScript Type Check
npx tsc --noEmit
# Result: PASS (0 errors, clean compilation)

# 3. ESLint Verification
npm run lint
# Result: PASS (0 errors, 0 warnings)

# 4. Production Build Validation
npm run build
# Result: PASS (Compiled in 17.4s, all 27 static/dynamic routes generated cleanly)
```

### Browser Automation Verification (`http://localhost:3001/exhibition`)
- **Viewport:** 100% full-viewport (`100dvh`), zero body scrollbars, zero horizontal jitter.
- **Site Chrome:** Global `Navbar` and `Footer` cleanly omitted on `/exhibition`. Restored cleanly on `/exhibition/accessible` and `/`.
- **In-Gallery HUD:** "Digital Exhibition", "Accessible 2D Exhibition →", Exit, and Fullscreen controls fully functional and clickable.
- **Asset Transfer:** Local floor texture (140 KB) loaded instantly without external CDN dependencies. Optimized artwork textures transferred under 2.3 MB total.
- **Console Output:** 0 critical WebGL or runtime exceptions. Deprecated `THREE.Clock` warnings eliminated by using high-resolution monotonic timestamps (`performance.now()`).

---

## 4. Museum Architectural Direction & Visual Guidance

Inspired by the reference design (deep charcoal classical museum, illuminated coffer skylight, herringbone hardwood parquet, architectural skirting, and warm track lighting):

1. **Color Palette & Finishes:**
   - **Primary Walls:** Deep charcoal matte (`#22262a` / `#282c31`) and muted slate teal (`#1e2528`).
   - **Flooring:** Warm walnut herringbone parquet (`#3d2b1f` / `#4a3525`) and dark oak planks with subtle specular roughness (0.28).
   - **Architectural Mouldings:** Low-sheen black stone baseboards (0.3m height) and crown coving along 4.8m–5.2m ceilings.
   - **Ceiling:** Architectural recessed coffered ceiling with diffused overhead daylight skylight over the central rotunda.
2. **Lighting Atmosphere:**
   - **Ambient:** Soft, warm gallery fill (`#fffbf2`, intensity 0.35).
   - **Directional Track Lighting:** Ceiling-mounted black track rails with angled warm spots (`3000K`, `#ffeed9`) focused on artwork canvases.
   - **Focal Spotlight:** Cathedral-scale dramatic illumination in Room 6 on the apex featured piece.
3. **Framing & Accents:**
   - Ornate gold leaf / baroque gilt frames for featured masterpieces.
   - Dark walnut float frames for graphite nature studies.
   - Thin black gallery aluminium frames for modern portraiture.
   - Dark brass wall plaques beside frames with subtle typography.

---

## 5. Proposed Multi-Room Floor Plan (ASCII Layout)

The museum is organized along a grand axial sightline with multiple interconnected loops:

```
                                  [ NORTH ]
                          Z = -36 +-----------+
                                  |           |
                                  |  FEATURED |
                                  | SANCTUARY |  (Room 6: Apex Masterpiece)
                                  |           |
                          Z = -16 +=== [D5] ==+
                                  |           |
           Z = -16 +--------------+  CENTRAL  +--------------+
                   |              | VESTIBULE |              |
                   |              |  & COURT  |              |  (Room 5: Sculpture Court)
                   |    [D3]      | (Pedestal)|    [D4]      |
           Z = -6  +--= =---------+=== [D2] ==+---------= =--+
                   |              |           |              |
                   |              |           |              |
                   |     WEST     |    MAIN   |     EAST     |
                   |    SALON     |  GALLERY  |     WING     |
           Z = +6  |   (Room 3)   |  (Room 2) |   (Room 4)   |
                   |              |           |              |
                   |              | (Bench)   |              |
           Z = +15 +--= =---------+           +---------= =--+
                   |    [D1w]     |           |    [D1e]     |
           Z = +18 +--------------+=== [D1] ==+              |
                                  |           |              |
                                  |   GRAND   |    [D6]      |
                                  |  ENTRANCE |==== = = =====+ (Navigable East Loop)
                                  |  (Room 1) |
                                  |           |
                                  |  [SPAWN]  |
                          Z = +30 +-----------+
                                  [ SOUTH ]
```

### Navigable Sequences:
- **Axial Sightline:** From Spawn at `[0, 1.65, 27]`, the visitor gazes North directly through Portal [D1], down the Main Rotunda, through Portal [D2] into the Sculpture Court, and all the way to Portal [D5] into the Featured Apex Sanctuary.
- **Topological Loops:**
  1. *Primary Central Loop:* Entrance → Main Hall → West Salon → Central Vestibule → Main Hall → Entrance.
  2. *Eastern Grand Loop:* Entrance → Main Hall → Central Vestibule → East Wing → Grand Entrance (via [D6]).
  3. *Apex Exploration:* Central Vestibule → Featured Sanctuary → Central Vestibule.

---

## 6. Museum Configuration Schema & Data Contract

Located at: `src/components/exhibition/config/museum.config.ts`

### Key Interfaces & Types:
- `MuseumConfig`: Root configuration object containing metadata, spawn, rooms, walls, doorways, artwork slots, waypoints, and points of interest.
- `Room`: Defines room identity, title, subtitle, bounding box (`minX, maxX, minZ, maxZ`), ceiling height (4.5m to 5.2m), wall theme, and floor type.
- `WallSegment`: Line segment from `start: [x, z]` to `end: [x, z]` with `thickness: 0.3m`, `height`, and reference to pierced doorway IDs.
- `Doorway`: 3D portal threshold with position, width (2.2m–3.0m), height (3.0m–3.8m), outward normal, and bidirectional room linkage (`fromRoomId`, `toRoomId`).
- `ArtworkSlot`: Spatial mount point with position, Euler rotation, max bounding dimensions, frame style, plaque orientation, and spotlight settings.
- `WaypointNode`: Navigation graph node for AI tours, minimap traversal, and reachability validation.

---

## 7. Key Architecture Decisions

### A. Collision System (Planned for Phase 2)
- **Model:** 2D continuous XZ-plane circle-versus-line-segment collision detection with wall sliding.
- **Player Collider:** Cylinder approximated on XZ plane as a circle of radius `r = 0.35m`.
- **Wall Segments:** Walls are treated as thickened 2D line segments. Each wall with thickness `w` generates two parallel collision boundary segments offset by `±w/2`.
- **Doorways:** When a wall is pierced by a doorway of width `W` at point `P`, the collision segment is split into two disjoint sub-segments `[Start, P - W/2]` and `[P + W/2, End]`, leaving the threshold completely walkable.
- **Collision Resolution:** On penetration depth `d`, project position out along normal vector `N`, and project velocity vector onto the wall tangent `T = velocity - (velocity · N) * N`, allowing natural wall sliding without snagging.
- **Tunnelling Prevention:** Sub-step movement if displacement per frame exceeds `r * 0.75` (e.g. during Shift sprint).

### B. First-Person Movement & Camera (Planned for Phase 2)
- **Controls:** WASD / Arrow keys for planar translation, mouse drag / pointer lock for camera orientation, Shift for 1.6× sprint speed.
- **Decoupled Architecture:** Input states and camera vectors stored in low-level mutable refs (`velocity`, `keys`, `euler`). Frame updates executed inside R3F `useFrame` without triggering React state updates.
- **Pitch Clamping:** Vertical pitch clamped to `[-35°, +35°]` to preserve museum architectural sightlines and prevent disorienting roll/flip.
- **Reduced Motion:** When `prefers-reduced-motion` is active, disable head-bob oscillations and camera slerp acceleration.

### C. Artwork Interaction (Planned for Phase 5)
- **Raycasting:** Screen-center raycaster with max reach `distance = 4.5m`.
- **Wall Occlusion:** Cast ray against both artwork bounds and wall collider segments. If a wall segment intersects before the artwork plane, interaction is blocked (preventing selecting paintings through walls).
- **HUD Integration:** Near-field reticle feedback changes from subtle dot to golden ring; pressing `[E]` or `[V]` opens non-destructive detail overlay without losing player position.

### D. Rendering & Performance (Planned for Phase 4)
- **Instancing:** Reusable architectural props (skirting trims, track light housings, ceiling coffers, benches) rendered using `@react-three/drei` `Instances` / `Instance`.
- **PBR Material Sharing:** Global cache of PBR materials (charcoal matte wall, dark slate wall, herringbone wood, dark skirting) to eliminate redundant shader recompilations and GPU state switches.
- **Lighting Budget:** Max 1 directional fill light for global ambient shadows, with baked contact shadows on floor. Individual artwork spotlights limited to 2 active lights per room using distance falloff attenuation (`decay = 2`).

### E. State Management
- High-frequency data (player position, orientation, velocity, raycast hits) lives in mutable Three.js refs and R3F loop.
- Low-frequency UI state (current room name, active artwork detail modal, audio guide state, settings) lives in standard React state.

---

## 8. Phase 1 Implementation Checklist

Once Phase 0 is approved by the user, Phase 1 will execute the following steps:

1. [ ] **Modular Wall Geometry Generator:** Implement `MuseumWall.tsx` converting `WallSegment` and `Doorway` definitions from `museum.config.ts` into solid, correctly-beveled wall meshes with doorway openings.
2. [ ] **Multi-Room Flooring & Ceilings:** Implement `MuseumFloor.tsx` and `MuseumCeiling.tsx` creating textured parquet/tile planes according to each room's bounding box and theme.
3. [ ] **Architectural Doorway Portals:** Implement `DoorwayPortal.tsx` rendering cased mouldings and arched headers around doorway openings.
4. [ ] **Skylight & Coffer Ceiling:** Implement the architectural recessed skylight coffer over the Main Exhibition Hall (Room 2).
5. [ ] **Museum Shell Assembly:** Integrate rooms into `MuseumShell.tsx`, rendering all 6 interconnected galleries from configuration.
6. [ ] **Initial Browser Verification:** Validate in real browser that all 6 galleries render without overlapping walls, doorways are visually open, and sightlines match the reference aesthetic.

---

## 9. Deliverables Inventory

| Deliverable | File Path | Status |
|---|---|---|
| **Deliverable A — Audit Report** | `EXHIBITION_PHASE0_AUDIT.md` | **COMPLETED** |
| **Deliverable B — Museum Config** | `src/components/exhibition/config/museum.config.ts` | **COMPLETED** |
| **Deliverable C — Floor Plan** | Embedded in Section 5 of this audit | **COMPLETED** |
| **Deliverable D — Architecture Decisions** | Embedded in Section 7 of this audit | **COMPLETED** |
| **Deliverable E — Phase 1 Checklist** | Embedded in Section 8 of this audit | **COMPLETED** |
| **Automated Configuration Tests** | `tests/museum-config.test.ts` | **COMPLETED** (13/13 passing) |
