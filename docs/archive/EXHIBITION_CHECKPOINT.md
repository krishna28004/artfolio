# Artfolio Virtual Museum — Checkpoint & Status Note
**Timestamp:** October 10, 2026  
**Branch:** `main`  
**Commit Type:** Checkpoint (`feat(exhibition): implement phase 3 artwork proximity raycasting and curatorial details modal`)

---

## 1. What Is Currently Implemented

### Phase 0: Architectural Foundation & Asset Pipeline
- **Exhibition Layout & Route Isolation:** Dedicated route layout in `src/app/exhibition/layout.tsx` and dynamic chrome suppression via `src/components/layout/AppChrome.tsx` (Navbar/Footer hidden only on `/exhibition`).
- **Museum Spatial Configuration:** 6 interconnected galleries defined in `src/components/exhibition/config/museum.config.ts`:
  - Room 1: Grand Entrance & Rotunda (`[0, 22.5]`, 25m × 15m)
  - Room 2: Classical Charcoal Gallery (`[-18.5, 0]`, 18m × 22m)
  - Room 3: Figurative Realism Hall (`[-18.5, -23.5]`, 18m × 17m)
  - Room 4: Contemporary East Wing (`[18.5, 11]`, 18m × 26m)
  - Room 5: Masterworks Sanctuary (`[0, -32.5]`, 15m × 25m)
  - Room 6: Intimate Graphite Study (`[18.5, -23.5]`, 18m × 17m)
- **Architectural 3D Shell Components:**
  - `MuseumShell.tsx`, `MuseumFloor.tsx`, `MuseumWall.tsx`, `MuseumCeiling.tsx`, `DoorwayPortal.tsx`, `MuseumBench.tsx`.
  - Material fallbacks and procedural texturing with oak wood parquet, off-white gallery walls, bronze trim, and warm museum downlighting.
- **Artwork Ingestion & Placement:**
  - Spatial coordinates and rotations mapped in `src/features/artwork/data/artworks.ts` and validated via `src/features/artwork/utils/exhibition-validation.ts`.
  - Seamless database merging in `src/features/artwork/services/artwork-service.ts`.
  - Double-sided frame rendering and localized spot lighting in `src/components/exhibition/ArtworkFrame.tsx`.

### Phase 2: First-Person Controller & Continuous Collision Engine
- **2D Swept Continuous Collision Detection (`src/components/exhibition/physics/collision.ts`):**
  - Continuous circle-AABB swept collision resolution preventing high-speed tunnelling.
  - Tangential sliding response preserving parallel velocity components upon wall impact.
  - Multi-iteration constraint solver (up to 4 iterations per frame).
  - Configurable player collision radius (0.35m), eye height (1.65m), walk speed (3.5 m/s), sprint speed (5.8 m/s).
  - Explicit doorway clearance calculations across all 6 inter-room portals (e.g., `d-ent-east` Portico Promenade connector at `Z: 21.8` to `24.0`).
  - Solid obstacle colliders for gallery benches across Rooms 2, 3, 4, and 6.
- **First-Person Controls (`src/components/exhibition/Controls.tsx`):**
  - Pointer Lock API integration with user onboarding overlay.
  - Keyboard input handling: WASD, Arrow keys, Shift (sprint), Space (jump/dampening).
  - Pitch clamping (-85° to +85°) preventing camera inversion.
  - Physics tick via `useFrame` utilizing delta-time integration.
  - Boundary fallback teleportation if player ever leaves the museum envelope (`[-35, 35] × [-48, 33]`).
- **Accessible & Legacy Fallbacks:**
  - Screen-reader accessible alternative at `/exhibition/accessible`.
  - Legacy single-hall view preserved via `?legacy=true` query parameter.

### Phase 3: Artwork Interactions & Curatorial Dossier
- **Raycast Line-of-Sight & Wall Occlusion (`src/components/exhibition/physics/collision.ts`):**
  - 2D line-of-sight raycasting (`hasLineOfSight`, `checkSegmentAABB`) testing line segment from player camera to artwork against all museum walls.
  - Prevents accidental selection of artworks located in adjacent rooms through solid partition walls.
  - Sub-segment $t$-clipping ($t \le 0.95$) preventing false self-occlusion from artwork mounting walls.
- **Proximity & Dot-Product Targeting:**
  - Range threshold of 5.5m combined with camera azimuth dot-product alignment ($\vec{f} \cdot \vec{d} > 0.82$, $\approx 35^\circ$ view cone).
  - Subtle camera soft-alignment toward inspected artwork without disorienting the visitor.
- **In-Gallery Contextual Prompt Card:**
  - Refined curatorial HUD card displaying artwork title, artist, year, medium, dimensions, an "Inspect Artwork" button, and keyboard cue `[E]`.
- **Accessible Curatorial Modal (`src/components/exhibition/ArtworkDetailModal.tsx`):**
  - High-definition artwork canvas presentation with loading shimmer and fallback error icon.
  - Full curatorial metadata: title, artist, year, medium, dimensions, descriptive essay, valuation in INR, and acquisition availability badge.
  - Fully accessible dialog (`role="dialog"`, `aria-modal="true"`, focus trap on mount and focus restoration on dismiss).
  - Keyboard shortcuts: `Escape` to close, `Tab` cycling through focusable elements, `[E]` or `[V]` or `Enter` to open.
  - Direct "Acquisition Dossier &rarr;" link to `/artwork/${id}`.
- **Input Isolation & Movement Freezing:**
  - Active keys cleared, velocity zeroed, and pointer lock released upon modal open.
  - Full visitor stationary safety while modal is open.
- **Direct 3D Mesh Interaction:**
  - Pointer hover cursor change and 3D frame click handling in `ArtworkFrame.tsx`.

---

## 2. Validation Status

| Check | Tool / Command | Status | Result |
| :--- | :--- | :--- | :--- |
| **ESLint** | `npm run lint` | **PASS** | 0 errors, 0 warnings across entire repository |
| **TypeScript** | `npx tsc --noEmit` | **PASS** | 0 type errors; strict mode compliant |
| **Node.js Test Suite** | `npm test` | **PASS** | 154 passed across 59 suites (0 failed, 0 skipped) |
| **Artwork Interaction Tests**| `tests/artwork-interaction.test.ts`| **PASS** | 14/14 passing (raycasting, line-of-sight, dot product, metadata, modal freeze) |
| **Collision Tests** | `tests/collision.test.ts` | **PASS** | 21/21 passing (swept collision, sliding, doorways, boundary containment) |
| **Museum Shell Tests**| `tests/museum-shell.test.ts`| **PASS** | Shell dimensions, wall counts, door portal bounds verified |
| **Museum Config Tests**| `tests/museum-config.test.ts`| **PASS** | 36 room, artwork, lighting, and audio assertions verified |
| **Production Build** | `npm run build` | **PASS** | All 27 static and dynamic Next.js routes built successfully |

---

## 3. Next Recommended Steps

1. Implement mobile virtual joystick touch controls for small screens.
2. Proceed to Phase 4: Spatial audio ambience, audio commentary guides, and in-museum cart checkout integration.
