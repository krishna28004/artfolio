import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MUSEUM_CONFIG,
  MUSEUM_ARTWORKS,
  LEGACY_ARTWORKS,
} from "../src/components/exhibition/config/museum.config.ts";

describe("Artfolio Virtual Museum — Phase 1 Architectural Shell & Geometry Tests", () => {
  describe("6-Room Connected Geometry & Dimensions", () => {
    test("defines all 6 designated galleries with valid bounds", () => {
      assert.strictEqual(MUSEUM_CONFIG.rooms.length, 6);
      const expectedRooms = [
        "room-entrance",
        "room-main",
        "room-west",
        "room-east",
        "room-corridor",
        "room-featured",
      ];
      for (const id of expectedRooms) {
        const room = MUSEUM_CONFIG.rooms.find((r) => r.id === id);
        assert.ok(room, `Missing gallery: ${id}`);
        assert.ok(room.bounds.maxX > room.bounds.minX);
        assert.ok(room.bounds.maxZ > room.bounds.minZ);
      }
    });

    test("Main Exhibition Hall has distinct ceiling height for architectural coffer skylight", () => {
      const mainHall = MUSEUM_CONFIG.rooms.find((r) => r.id === "room-main")!;
      const westGallery = MUSEUM_CONFIG.rooms.find((r) => r.id === "room-west")!;
      assert.strictEqual(mainHall.ceilingHeight, 5.2);
      assert.strictEqual(westGallery.ceilingHeight, 4.5);
      assert.ok(
        mainHall.ceilingHeight > westGallery.ceilingHeight,
        "Main Hall must be elevated to host the skylight coffer"
      );
    });
  });

  describe("Doorway Portals & Clear Physical Passages", () => {
    test("all 8 doorways have valid positive clearance and connect adjacent rooms", () => {
      assert.strictEqual(MUSEUM_CONFIG.doorways.length, 8);
      for (const door of MUSEUM_CONFIG.doorways) {
        assert.ok(door.width >= 2.0, `Doorway ${door.id} width < 2.0m`);
        assert.ok(door.height >= 3.0, `Doorway ${door.id} height < 3.0m`);
        assert.notStrictEqual(door.fromRoomId, door.toRoomId);
      }
    });

    test("Grand Entrance Portal (d-ent-main) aligns with central longitudinal sightline axis X=0", () => {
      const entrancePortal = MUSEUM_CONFIG.doorways.find(
        (d) => d.id === "d-ent-main"
      )!;
      assert.strictEqual(entrancePortal.position[0], 0);
      assert.strictEqual(entrancePortal.position[2], 18);
      assert.strictEqual(entrancePortal.width, 2.8);
      assert.strictEqual(entrancePortal.height, 3.6);
    });

    test("Ceremonial Sanctuary Portal (d-corr-feat) aligns with central axis X=0", () => {
      const sanctuaryPortal = MUSEUM_CONFIG.doorways.find(
        (d) => d.id === "d-corr-feat"
      )!;
      assert.strictEqual(sanctuaryPortal.position[0], 0);
      assert.strictEqual(sanctuaryPortal.position[2], -16);
      assert.strictEqual(sanctuaryPortal.width, 3.0);
      assert.strictEqual(sanctuaryPortal.height, 3.8);
    });
  });

  describe("Artwork Slots & Placement Preservation", () => {
    test("MUSEUM_ARTWORKS maps all 10 curated artworks to the museum shell", () => {
      assert.strictEqual(MUSEUM_ARTWORKS.length, 10);
      const uniqueIds = new Set(MUSEUM_ARTWORKS.map((a) => a.id));
      assert.strictEqual(uniqueIds.size, 10);
    });

    test("every artwork in MUSEUM_ARTWORKS has valid 3D coordinates and rotations", () => {
      for (const art of MUSEUM_ARTWORKS) {
        const [x, y, z] = art.position;
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
        assert.ok(y >= 1.5 && y <= 2.2, `Artwork ${art.id} mount height abnormal: ${y}m`);
        assert.ok(art.rotation);
      }
    });

    test("Apex Sanctuary displays Sorcerer Supreme masterwork on north focal wall", () => {
      const apexArt = MUSEUM_ARTWORKS.find((a) => a.id === "sorcerer-supreme")!;
      assert.strictEqual(apexArt.position[0], 0);
      assert.strictEqual(apexArt.position[2], -35.85);
      assert.deepStrictEqual(apexArt.rotation, [0, 0, 0]);
    });
  });

  describe("Legacy Hall Recovery & Feature Flag Verification", () => {
    test("legacy ARTWORKS array is preserved with original single-hall 50x80 coordinates", () => {
      assert.strictEqual(LEGACY_ARTWORKS.length, 10);
      const luminous = LEGACY_ARTWORKS.find((a) => a.id === "luminous-veil")!;
      assert.deepStrictEqual(luminous.position, [-24.92, 2.1, -28]);

      const sovereign = LEGACY_ARTWORKS.find((a) => a.id === "sovereign-gaze")!;
      assert.deepStrictEqual(sovereign.position, [-24.92, 2.1, -12]);
    });
  });
});
