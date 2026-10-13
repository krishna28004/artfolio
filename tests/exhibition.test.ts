import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  isValid3DPosition,
  isValid3DRotation,
  calculateFrameDimensions,
  clampToWalkableBounds,
  VISITOR_BOUNDS,
} from "../src/features/artwork/utils/exhibition-validation.ts";
import { artworks as staticArtworks } from "../src/features/artwork/data/artworks.ts";
import { mapDbArtworkToDomain } from "../src/features/artwork/services/artwork-service.ts";

describe("Virtual Exhibition — 3D Geometry, Validation & Architecture Tests", () => {
  describe("3D Position Validation (isValid3DPosition)", () => {
    test("accepts valid coordinates within gallery room boundaries", () => {
      assert.strictEqual(isValid3DPosition([-24.92, 2.1, -28]), true);
      assert.strictEqual(isValid3DPosition([24.92, 2.1, 20]), true);
      assert.strictEqual(isValid3DPosition([0, 2.1, -39.92]), true);
      assert.strictEqual(isValid3DPosition([0, 1.6, 0]), true);
    });

    test("rejects coordinates outside gallery room walls", () => {
      // Room boundaries are X: [-25, 25], Y: [0, 7], Z: [-40, 40]
      assert.strictEqual(isValid3DPosition([-26, 2.1, 0]), false); // Outside west wall
      assert.strictEqual(isValid3DPosition([26, 2.1, 0]), false); // Outside east wall
      assert.strictEqual(isValid3DPosition([0, 2.1, -41]), false); // Beyond north wall
      assert.strictEqual(isValid3DPosition([0, 2.1, 41]), false); // Beyond south wall
      assert.strictEqual(isValid3DPosition([0, 8, 0]), false); // Above ceiling
      assert.strictEqual(isValid3DPosition([0, -1, 0]), false); // Below floor
    });

    test("rejects non-numeric, NaN, Infinity, null, and malformed structures", () => {
      assert.strictEqual(isValid3DPosition(null), false);
      assert.strictEqual(isValid3DPosition(undefined), false);
      assert.strictEqual(isValid3DPosition([NaN, 2.1, 0]), false);
      assert.strictEqual(isValid3DPosition([0, Infinity, 0]), false);
      assert.strictEqual(isValid3DPosition([-Infinity, 2.1, 0]), false);
      assert.strictEqual(isValid3DPosition([0, 0]), false); // 2 elements instead of 3
      assert.strictEqual(isValid3DPosition([0, 0, 0, 0]), false); // 4 elements
      assert.strictEqual(isValid3DPosition(["0", "2.1", "0"]), false); // string inputs
      assert.strictEqual(isValid3DPosition("[-24.92, 2.1, -28]"), false);
    });
  });

  describe("3D Rotation Validation (isValid3DRotation)", () => {
    test("accepts valid 3-axis rotation tuples", () => {
      assert.strictEqual(isValid3DRotation([0, 0, 0]), true);
      assert.strictEqual(isValid3DRotation([0, Math.PI / 2, 0]), true);
      assert.strictEqual(isValid3DRotation([0, -Math.PI / 2, 0]), true);
      assert.strictEqual(isValid3DRotation([0.1, -0.2, 0.3]), true);
    });

    test("rejects malformed rotation inputs", () => {
      assert.strictEqual(isValid3DRotation(null), false);
      assert.strictEqual(isValid3DRotation(undefined), false);
      assert.strictEqual(isValid3DRotation([0, NaN, 0]), false);
      assert.strictEqual(isValid3DRotation([0, 0]), false);
      assert.strictEqual(isValid3DRotation([0, 0, 0, 0]), false);
    });
  });

  describe("Aspect Ratio & Frame Proportion Calculations (calculateFrameDimensions)", () => {
    test("calculates accurate portrait dimensions without distortion (3:4 ratio)", () => {
      const dims = calculateFrameDimensions(900, 1200, 1.6, 0.10, 0.04);
      assert.strictEqual(dims.aspect, 0.75);
      assert.strictEqual(dims.artHeight, 1.6);
      assert.strictEqual(dims.artWidth, 1.2);
      assert.strictEqual(dims.matWidth, 1.4);
      assert.strictEqual(dims.matHeight, 1.8);
      assert.strictEqual(dims.frameWidth, 1.48);
      assert.strictEqual(dims.frameHeight, 1.88);
    });

    test("calculates accurate landscape dimensions without distortion (16:9 ratio)", () => {
      const dims = calculateFrameDimensions(1600, 900, 1.6, 0.10, 0.04);
      assert.ok(Math.abs(dims.aspect - 16 / 9) < 0.001);
      assert.strictEqual(dims.artWidth, 1.6);
      assert.ok(Math.abs(dims.artHeight - 1.6 / (16 / 9)) < 0.001); // 0.9
      assert.ok(dims.matWidth > dims.artWidth);
      assert.ok(dims.frameWidth > dims.matWidth);
    });

    test("calculates accurate square dimensions without distortion (1:1 ratio)", () => {
      const dims = calculateFrameDimensions(1000, 1000, 1.6, 0.10, 0.04);
      assert.strictEqual(dims.aspect, 1.0);
      assert.strictEqual(dims.artWidth, 1.6);
      assert.strictEqual(dims.artHeight, 1.6);
      assert.strictEqual(dims.matWidth, 1.8);
      assert.strictEqual(dims.matHeight, 1.8);
      assert.strictEqual(dims.frameWidth, 1.88);
      assert.strictEqual(dims.frameHeight, 1.88);
    });

    test("falls back gracefully when texture dimensions are missing or zero", () => {
      const dimsZero = calculateFrameDimensions(0, 0);
      assert.strictEqual(dimsZero.aspect, 0.75); // default fallback
      assert.ok(dimsZero.artWidth > 0);
      assert.ok(dimsZero.artHeight > 0);

      const dimsUndefined = calculateFrameDimensions(undefined, undefined);
      assert.strictEqual(dimsUndefined.aspect, 0.75);
      assert.ok(dimsUndefined.artWidth > 0);
    });

    test("clamps extreme aspect ratios to prevent scene-breaking distortion", () => {
      const ultraWide = calculateFrameDimensions(10000, 100);
      assert.strictEqual(ultraWide.aspect, 3.0); // clamped to max 3.0

      const ultraTall = calculateFrameDimensions(100, 10000);
      assert.strictEqual(ultraTall.aspect, 0.3); // clamped to min 0.3
    });
  });

  describe("Walkable Boundary Clamping (clampToWalkableBounds)", () => {
    test("keeps points inside visitor bounds unchanged", () => {
      const clamped = clampToWalkableBounds(0, 0);
      assert.strictEqual(clamped.x, 0);
      assert.strictEqual(clamped.z, 0);
    });

    test("clamps out-of-bounds clicks to visitor boundary box", () => {
      const clampedFarEast = clampToWalkableBounds(30, 0);
      assert.strictEqual(clampedFarEast.x, VISITOR_BOUNDS.maxX); // 23

      const clampedFarWest = clampToWalkableBounds(-30, 0);
      assert.strictEqual(clampedFarWest.x, VISITOR_BOUNDS.minX); // -23

      const clampedFarNorth = clampToWalkableBounds(0, -50);
      assert.strictEqual(clampedFarNorth.z, VISITOR_BOUNDS.minZ); // -38

      const clampedFarSouth = clampToWalkableBounds(0, 50);
      assert.strictEqual(clampedFarSouth.z, VISITOR_BOUNDS.maxZ); // 38
    });
  });

  describe("Static Artwork Catalog Integrity & Exhibition Placements", () => {
    test("catalog contains all 10 curated artworks", () => {
      assert.strictEqual(staticArtworks.length, 10);
    });

    test("every artwork has valid 3D coordinates, rotations, and wall identifiers", () => {
      const ids = new Set<string>();
      const positions = new Set<string>();

      for (const art of staticArtworks) {
        // Unique IDs
        assert.ok(!ids.has(art.id), `Duplicate artwork ID found: ${art.id}`);
        ids.add(art.id);

        // Valid metadata
        assert.ok(art.title.length > 0, `Artwork ${art.id} has empty title`);
        assert.ok(art.imageUrl.length > 0, `Artwork ${art.id} has empty imageUrl`);
        assert.ok(art.textureUrl?.length, `Artwork ${art.id} missing optimized textureUrl`);

        // 3D positioning
        assert.ok(art.position3D, `Artwork ${art.id} missing position3D`);
        assert.strictEqual(
          isValid3DPosition(art.position3D),
          true,
          `Artwork ${art.id} position3D is invalid or out of room bounds: ${JSON.stringify(art.position3D)}`
        );

        // 3D rotation
        assert.ok(art.rotation3D, `Artwork ${art.id} missing rotation3D`);
        assert.strictEqual(
          isValid3DRotation(art.rotation3D),
          true,
          `Artwork ${art.id} rotation3D is invalid: ${JSON.stringify(art.rotation3D)}`
        );

        // Wall identifier
        assert.ok(art.wallIdentifier, `Artwork ${art.id} missing wallIdentifier`);

        // No overlapping positions
        const posKey = art.position3D.join(",");
        assert.ok(!positions.has(posKey), `Overlapping artwork position: ${posKey}`);
        positions.add(posKey);
      }
    });

    test("artworks face inward towards visitors", () => {
      for (const art of staticArtworks) {
        const [x] = art.position3D!;
        const [, ry] = art.rotation3D!;

        if (x < -20) {
          // West wall: should face East (+Math.PI / 2)
          assert.strictEqual(ry, Math.PI / 2);
        } else if (x > 20) {
          // East wall: should face West (-Math.PI / 2)
          assert.strictEqual(ry, -Math.PI / 2);
        } else {
          // North wall: should face South (0)
          assert.strictEqual(ry, 0);
        }
      }
    });
  });

  describe("Database Mapping Fallback (mapDbArtworkToDomain)", () => {
    test("uses the museum slot when database coordinates are absent", () => {
      const mockDbRow = {
        id: "luminous-veil",
        title: "Luminous Veil (Custom Title)",
        artist: "Krishna Kumar",
        created_at: "2024-01-01T00:00:00Z",
        description: "Test description",
        image_url: "/images/artworks/luminous-veil.jpg",
        thumbnail_url: null,
        medium: "Pencil on Paper",
        dimensions: "A3 Sheet",
        price: 5000,
        category: "portrait",
        is_available: true,
        display_order: 1,
        position_3d: null, // DB missing 3D coordinates
        rotation_3d: null,
        wall_identifier: "main-west-1",
      };

      const domain = mapDbArtworkToDomain(mockDbRow as unknown as Parameters<typeof mapDbArtworkToDomain>[0]);
      assert.ok(domain.position3D);
      assert.deepStrictEqual(domain.position3D, [-9.85, 1.6, 12]);
      assert.deepStrictEqual(domain.rotation3D, [0, Math.PI / 2, 0]);
      assert.strictEqual(domain.wallIdentifier, "main-west-1");
    });

    test("an unassigned database artwork does not inherit a demo placement", () => {
      const domain = mapDbArtworkToDomain({
        id: "luminous-veil", title: "Luminous Veil", artist: "Krishna Kumar", year: 2024,
        image_url: "/images/artworks/luminous-veil.jpg", image_urls: [],
        is_available: true, sale_status: "available", position_3d: null,
        rotation_3d: null, wall_identifier: null,
      } as unknown as Parameters<typeof mapDbArtworkToDomain>[0]);
      assert.equal(domain.position3D, undefined);
      assert.equal(domain.wallIdentifier, undefined);
    });

    test("preserves valid custom database 3D positions if provided", () => {
      const mockDbRowWith3D = {
        id: "luminous-veil",
        title: "Luminous Veil",
        artist: "Krishna Kumar",
        created_at: "2024-01-01T00:00:00Z",
        description: "Test",
        image_url: "/images/artworks/luminous-veil.jpg",
        thumbnail_url: null,
        medium: "Pencil on Paper",
        dimensions: "A3 Sheet",
        price: 5000,
        category: "portrait",
        is_available: true,
        display_order: 1,
        position_3d: [-20, 2.5, -15],
        rotation_3d: [0, 1.57, 0],
        wall_identifier: "custom-wall",
      };

      const domain = mapDbArtworkToDomain(mockDbRowWith3D as unknown as Parameters<typeof mapDbArtworkToDomain>[0]);
      assert.deepStrictEqual(domain.position3D, [-20, 2.5, -15]);
      assert.deepStrictEqual(domain.rotation3D, [0, 1.57, 0]);
      assert.strictEqual(domain.wallIdentifier, "custom-wall");
    });
  });
});
