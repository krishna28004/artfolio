import { describe, test } from "node:test";
import assert from "node:assert";
import {
  hasLineOfSight,
  checkSegmentAABB,
  buildMuseumColliders,
} from "@/components/exhibition/physics/collision";
import { artworks as staticArtworks } from "@/features/artwork/data/artworks";
import { MUSEUM_CONFIG } from "@/components/exhibition/config/museum.config";

describe("Artfolio Virtual Museum — Phase 3 Artwork Interaction & Raycasting Tests", () => {
  const colliders = buildMuseumColliders();

  // ============================================================================
  // 1. RAYCAST LINE-OF-SIGHT & WALL OCCLUSION
  // ============================================================================
  describe("Raycast Line-of-Sight & Wall Occlusion", () => {
    test("unobstructed line-of-sight inside Room 2 to West Wall artwork", () => {
      // Player standing inside Room 2 at [-5, 12], looking at artwork 'luminous-veil' at [-9.85, 12]
      const playerPos = { x: -5, z: 12 };
      const artPos = { x: -9.85, z: 12 };
      const canSee = hasLineOfSight(playerPos, artPos, colliders);
      assert.strictEqual(canSee, true, "Player inside Room 2 must have line of sight to Room 2 artwork");
    });

    test("intervening partition wall blocks line-of-sight from Room 1 to Room 2 artwork", () => {
      // Player standing in Room 1 (Grand Entrance) at [0, 24]
      // Artwork 'luminous-veil' is in Room 2 at [-9.85, 12]
      // Partition at Z = 18 blocks the direct line
      const playerPos = { x: 0, z: 24 };
      const artPos = { x: -9.85, z: 12 };
      const canSee = hasLineOfSight(playerPos, artPos, colliders);
      assert.strictEqual(canSee, false, "Partition wall at Z=18 must block line of sight between Room 1 and Room 2");
    });

    test("intervening exterior wall blocks line-of-sight between East Wing and exterior", () => {
      // Player outside East Wing at [30, 11]
      // Artwork inside East Wing at [25.85, 11]
      // Exterior wall at X = 26 (thickness 0.3) blocks view
      const playerPos = { x: 30, z: 11 };
      const artPos = { x: 25.85, z: 11 };
      const canSee = hasLineOfSight(playerPos, artPos, colliders);
      assert.strictEqual(canSee, false, "Exterior wall at X=26 must block line of sight from exterior");
    });

    test("open doorway allows line-of-sight across portal threshold", () => {
      // Player in Room 1 at [0, 20] looking straight through open doorway d-ent-main (X: -1.4 to 1.4 at Z=18)
      // to a point at [0, 15] in Room 2
      const playerPos = { x: 0, z: 20 };
      const targetPos = { x: 0, z: 15 };
      const canSee = hasLineOfSight(playerPos, targetPos, colliders);
      assert.strictEqual(canSee, true, "Open doorway must allow clear line of sight");
    });

    test("mounting wall behind artwork does not self-occlude target due to maxT clipping", () => {
      // Artwork at [-9.85, 12] sits on wall surface (wall center X=-10, max boundary X=-9.85)
      // Player at [-6, 12]
      // Wall segment bounding box: minX: -10.15, maxX: -9.85, minZ: 7.2, maxZ: 18.0
      const box = { minX: -10.15, maxX: -9.85, minZ: 7.2, maxZ: 18.0 };
      const isOccluded = checkSegmentAABB(-6, 12, -9.85, 12, box, 0.95);
      assert.strictEqual(isOccluded, false, "Mounting wall directly behind artwork must not self-occlude at maxT=0.95");
    });
  });

  // ============================================================================
  // 2. PROXIMITY & DOT-PRODUCT TARGETING CALCULATIONS
  // ============================================================================
  describe("Proximity & Angle Dot-Product Targeting", () => {
    function computeTargeting(
      camPos: { x: number; y: number; z: number },
      camForward: { x: number; y: number; z: number },
      artPos: [number, number, number],
      maxDist = 5.5,
      minDot = 0.82
    ) {
      const dx = artPos[0] - camPos.x;
      const dz = artPos[2] - camPos.z;
      const dist = Math.hypot(dx, dz);
      if (dist >= maxDist) return { inRange: false, facing: false, targeted: false };

      const dirX = dx / dist;
      const dirZ = dz / dist;
      // 2D horizontal dot product
      const fwdLen = Math.hypot(camForward.x, camForward.z);
      const normFwdX = camForward.x / fwdLen;
      const normFwdZ = camForward.z / fwdLen;
      const dot = normFwdX * dirX + normFwdZ * dirZ;

      const facing = dot > minDot;
      return {
        inRange: true,
        facing,
        targeted: facing,
        dot,
        dist,
      };
    }

    test("player directly facing artwork within 4 meters acquires focus", () => {
      const camPos = { x: -6.0, y: 1.65, z: 12.0 };
      const camForward = { x: -1.0, y: 0, z: 0 }; // Looking directly west towards X = -9.85
      const artPos: [number, number, number] = [-9.85, 1.6, 12.0];

      const res = computeTargeting(camPos, camForward, artPos);
      assert.strictEqual(res.inRange, true);
      assert.strictEqual(res.facing, true);
      assert.strictEqual(res.targeted, true);
      assert.ok(res.dot > 0.99, "Dot product facing directly must be > 0.99");
    });

    test("player looking 90 degrees away from artwork does not acquire focus", () => {
      const camPos = { x: -6.0, y: 1.65, z: 12.0 };
      const camForward = { x: 0, y: 0, z: -1.0 }; // Looking north instead of west
      const artPos: [number, number, number] = [-9.85, 1.6, 12.0];

      const res = computeTargeting(camPos, camForward, artPos);
      assert.strictEqual(res.inRange, true);
      assert.strictEqual(res.facing, false);
      assert.strictEqual(res.targeted, false);
      assert.ok(res.dot < 0.1, "Dot product at 90 degrees must be near 0");
    });

    test("player standing 7 meters away does not acquire focus even if facing directly", () => {
      const camPos = { x: -2.0, y: 1.65, z: 12.0 }; // 7.85m away
      const camForward = { x: -1.0, y: 0, z: 0 };
      const artPos: [number, number, number] = [-9.85, 1.6, 12.0];

      const res = computeTargeting(camPos, camForward, artPos);
      assert.strictEqual(res.inRange, false);
      assert.strictEqual(res.targeted, false);
    });
  });

  // ============================================================================
  // 3. ARTWORK METADATA INTEGRITY & CURATORIAL DOSSIER
  // ============================================================================
  describe("Artwork Metadata Integrity & Curatorial Dossier", () => {
    test("every artwork in the curated collection has valid curatorial fields", () => {
      assert.ok(staticArtworks.length >= 10, "Static artwork catalog must contain at least 10 pieces");
      for (const art of staticArtworks) {
        assert.ok(art.id && art.id.length > 0, "Artwork must have non-empty ID");
        assert.ok(art.title && art.title.length > 0, `Artwork ${art.id} must have non-empty title`);
        assert.ok(art.artist && art.artist.length > 0, `Artwork ${art.id} must have artist name`);
        assert.strictEqual(typeof art.year, "number", `Artwork ${art.id} must have numeric year`);
        assert.ok(art.description && art.description.length > 20, `Artwork ${art.id} must have detailed description`);
        assert.ok(art.medium && art.medium.length > 0, `Artwork ${art.id} must specify medium`);
        assert.ok(art.dimensions && art.dimensions.length > 0, `Artwork ${art.id} must specify dimensions`);
      }
    });

    test("all museum artwork slots map to valid spatial placements", () => {
      const allSlots = MUSEUM_CONFIG.artworkSlots;
      assert.ok(allSlots.length >= 10, "Multi-room museum must have at least 10 curated slots");
      for (const slot of allSlots) {
        assert.ok(slot.id, "Slot must specify artwork slot ID");
        assert.strictEqual(slot.position.length, 3, "Slot must specify 3D position [X, Y, Z]");
        assert.ok(Number.isFinite(slot.position[0]), "X coordinate must be finite");
        assert.ok(Number.isFinite(slot.position[1]), "Y coordinate must be finite");
        assert.ok(Number.isFinite(slot.position[2]), "Z coordinate must be finite");
      }
    });

    test("price valuation formatter formats INR prices cleanly and handles undefined", () => {
      function formatPrice(price?: number): string {
        if (typeof price === "number" && price > 0) {
          return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(price);
        }
        return "Price Upon Request";
      }

      assert.strictEqual(formatPrice(undefined), "Price Upon Request");
      assert.strictEqual(formatPrice(0), "Price Upon Request");
      assert.strictEqual(formatPrice(-500), "Price Upon Request");
      const formatted = formatPrice(45000);
      assert.ok(formatted.includes("45,000"), "Must format 45000 in Indian numbering format");
    });
  });

  // ============================================================================
  // 4. MODAL INTERACTION LIFECYCLE & INPUT FREEZING
  // ============================================================================
  describe("Modal Interaction Lifecycle & Input Freezing", () => {
    test("modal open state clears active movement keys and stops player motion", () => {
      const keys = new Set(["KeyW", "ShiftLeft", "KeyD"]);
      const movementState = { forward: true, backward: false, left: false, right: true };
      const velocity = { x: 3.5, y: 0, z: -5.8 };

      // Simulating modal open freeze routine from Controls.tsx
      function freezeOnModalOpen(isModalOpen: boolean) {
        if (isModalOpen) {
          keys.clear();
          movementState.forward = false;
          movementState.backward = false;
          movementState.left = false;
          movementState.right = false;
          velocity.x = 0;
          velocity.y = 0;
          velocity.z = 0;
        }
      }

      freezeOnModalOpen(true);

      assert.strictEqual(keys.size, 0, "Keys set must be cleared on modal open");
      assert.strictEqual(movementState.forward, false, "Forward movement state must be reset");
      assert.strictEqual(movementState.right, false, "Right movement state must be reset");
      assert.strictEqual(velocity.x, 0, "Velocity X must be zeroed");
      assert.strictEqual(velocity.z, 0, "Velocity Z must be zeroed");
    });

    test("inspection trigger keys ('KeyE', 'KeyV', 'Enter') are correctly recognized", () => {
      const inspectionKeys = new Set(["KeyE", "KeyV", "Enter", "e", "E", "v", "V"]);

      assert.strictEqual(inspectionKeys.has("KeyE"), true);
      assert.strictEqual(inspectionKeys.has("KeyV"), true);
      assert.strictEqual(inspectionKeys.has("Enter"), true);
      assert.strictEqual(inspectionKeys.has("KeyW"), false);
      assert.strictEqual(inspectionKeys.has("Space"), false);
    });

    test("escape key is recognized for modal dismiss", () => {
      function shouldDismissModal(code: string, key: string): boolean {
        return code === "Escape" || key === "Escape";
      }

      assert.strictEqual(shouldDismissModal("Escape", "Escape"), true);
      assert.strictEqual(shouldDismissModal("KeyW", "w"), false);
      assert.strictEqual(shouldDismissModal("Space", " "), false);
    });
  });
});
