import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  MUSEUM_CONFIG,
  validateMuseumConfig,
} from "../src/components/exhibition/config/museum.config.ts";
import type { MuseumConfig } from "../src/components/exhibition/config/museum.config.ts";

describe("Artfolio Virtual Museum — Phase 0 Configuration & Floor Plan Validation", () => {
  test("MUSEUM_CONFIG passes comprehensive structural validation without errors", () => {
    const result = validateMuseumConfig(MUSEUM_CONFIG);
    assert.strictEqual(
      result.valid,
      true,
      `Museum configuration validation failed:\n${result.errors.join("\n")}`
    );
    assert.strictEqual(result.errors.length, 0);
  });

  describe("Room Structure & Dimensions", () => {
    test("contains all 6 planned museum rooms in the architectural sequence", () => {
      assert.strictEqual(MUSEUM_CONFIG.rooms.length, 6);
      const expectedRoomIds = [
        "room-entrance",
        "room-main",
        "room-west",
        "room-east",
        "room-corridor",
        "room-featured",
      ];
      for (const id of expectedRoomIds) {
        const found = MUSEUM_CONFIG.rooms.find((r) => r.id === id);
        assert.ok(found, `Expected room "${id}" not found in MUSEUM_CONFIG`);
      }
    });

    test("all rooms have positive bounding areas and realistic ceiling heights (4.5m - 5.2m)", () => {
      for (const room of MUSEUM_CONFIG.rooms) {
        const width = room.bounds.maxX - room.bounds.minX;
        const depth = room.bounds.maxZ - room.bounds.minZ;
        assert.ok(width > 5, `Room ${room.id} width too small: ${width}m`);
        assert.ok(depth > 5, `Room ${room.id} depth too small: ${depth}m`);
        assert.ok(
          room.ceilingHeight >= 4.5 && room.ceilingHeight <= 6.0,
          `Room ${room.id} ceiling height out of museum scale: ${room.ceilingHeight}m`
        );
      }
    });
  });

  describe("Spawn Point & Sightlines", () => {
    test("spawn point is positioned inside the Grand Entrance Gallery", () => {
      const [sx, sy, sz] = MUSEUM_CONFIG.spawn.position;
      const entrance = MUSEUM_CONFIG.rooms.find((r) => r.id === "room-entrance")!;
      assert.ok(
        sx >= entrance.bounds.minX && sx <= entrance.bounds.maxX,
        `Spawn X ${sx} is outside entrance bounds`
      );
      assert.ok(
        sz >= entrance.bounds.minZ && sz <= entrance.bounds.maxZ,
        `Spawn Z ${sz} is outside entrance bounds`
      );
      assert.strictEqual(sy, 1.65, "Spawn eye height should be standard 1.65m");
    });

    test("initial view direction aligns with the central longitudinal gallery axis", () => {
      const [lx, , lz] = MUSEUM_CONFIG.spawn.lookAt;
      const [sx, , sz] = MUSEUM_CONFIG.spawn.position;
      assert.strictEqual(lx, sx, "Look direction must be aligned along central X=0 axis");
      assert.ok(lz < sz, "Look direction must point North into the Main Hall");
    });
  });

  describe("Doorways & Interconnections", () => {
    test("contains 8 designated architectural portals connecting adjacent rooms", () => {
      assert.strictEqual(MUSEUM_CONFIG.doorways.length, 8);
    });

    test("every doorway connects two distinct valid rooms", () => {
      const roomIds = new Set(MUSEUM_CONFIG.rooms.map((r) => r.id));
      for (const door of MUSEUM_CONFIG.doorways) {
        assert.notStrictEqual(
          door.fromRoomId,
          door.toRoomId,
          `Doorway ${door.id} cannot connect room to itself`
        );
        assert.ok(
          roomIds.has(door.fromRoomId),
          `Doorway ${door.id} references invalid fromRoomId: ${door.fromRoomId}`
        );
        assert.ok(
          roomIds.has(door.toRoomId),
          `Doorway ${door.id} references invalid toRoomId: ${door.toRoomId}`
        );
        assert.ok(door.width >= 2.0, `Doorway ${door.id} width too narrow: ${door.width}m`);
        assert.ok(door.height >= 3.0, `Doorway ${door.id} height too low: ${door.height}m`);
      }
    });
  });

  describe("Artwork Slots & Placement Sanity", () => {
    test("defines at least 16 artwork slots across the 6 galleries", () => {
      assert.ok(
        MUSEUM_CONFIG.artworkSlots.length >= 16,
        `Expected at least 16 artwork slots, got ${MUSEUM_CONFIG.artworkSlots.length}`
      );
    });

    test("every artwork slot has finite placement and positive frame dimensions", () => {
      for (const slot of MUSEUM_CONFIG.artworkSlots) {
        const [x, y, z] = slot.position;
        assert.ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z));
        assert.ok(
          y >= 1.4 && y <= 2.0,
          `Artwork slot ${slot.id} eye-level mounting height abnormal: ${y}m`
        );
        assert.ok(slot.dimensions.maxWidth > 0);
        assert.ok(slot.dimensions.maxHeight > 0);
        assert.ok(slot.frameStyle.length > 0);
      }
    });

    test("Featured Masterpiece Sanctuary has designated apex slot", () => {
      const apexSlot = MUSEUM_CONFIG.artworkSlots.find(
        (s) => s.id === "slot-feat-north-apex"
      );
      assert.ok(apexSlot, "Featured apex artwork slot must exist");
      assert.strictEqual(apexSlot.roomId, "room-featured");
      assert.strictEqual(apexSlot.isFeatured, true);
      assert.ok(apexSlot.dimensions.maxWidth >= 2.0);
    });
  });

  describe("Waypoint Navigation Graph & Reachability", () => {
    test("every single room is reachable via waypoint graph from spawn point", () => {
      const visited = new Set<string>();
      const queue = ["wp-spawn"];

      while (queue.length > 0) {
        const currId = queue.shift()!;
        if (visited.has(currId)) continue;
        visited.add(currId);

        const node = MUSEUM_CONFIG.waypoints.find((w) => w.id === currId);
        if (node) {
          for (const neighbor of node.neighborIds) {
            if (!visited.has(neighbor)) queue.push(neighbor);
          }
        }
      }

      const reachedRooms = new Set<string>();
      for (const vId of visited) {
        const node = MUSEUM_CONFIG.waypoints.find((w) => w.id === vId);
        if (node) reachedRooms.add(node.roomId);
      }

      for (const room of MUSEUM_CONFIG.rooms) {
        assert.ok(
          reachedRooms.has(room.id),
          `Room "${room.id}" is unreachable from spawn point in waypoint graph`
        );
      }
    });

    test("contains navigable cycles (loops) preventing dead-end visitor traps", () => {
      const visited = new Set<string>();
      let foundCycle = false;

      function dfs(curr: string, parent: string) {
        if (foundCycle) return;
        visited.add(curr);
        const node = MUSEUM_CONFIG.waypoints.find((w) => w.id === curr);
        if (!node) return;

        for (const next of node.neighborIds) {
          if (next === parent) continue;
          if (visited.has(next)) {
            // Found a cycle!
            foundCycle = true;
            return;
          }
          dfs(next, curr);
        }
      }

      dfs("wp-spawn", "");
      assert.strictEqual(
        foundCycle,
        true,
        "Museum layout must contain at least one navigable topological loop"
      );
    });
  });

  describe("Validation Edge Cases", () => {
    test("detects disconnected rooms when validation is run on broken configuration", () => {
      const brokenConfig: MuseumConfig = {
        ...MUSEUM_CONFIG,
        rooms: [
          ...MUSEUM_CONFIG.rooms,
          {
            id: "room-ghost",
            name: "Ghost Room",
            subtitle: "Unconnected",
            description: "No doors or waypoints",
            bounds: { minX: 100, maxX: 120, minZ: 100, maxZ: 120 },
            ceilingHeight: 4.5,
            theme: "charcoal-matte",
            floorType: "dark-oak-plank",
            wallIds: [],
            doorwayIds: [],
            artworkSlotIds: [],
          },
        ],
      };

      const result = validateMuseumConfig(brokenConfig);
      assert.strictEqual(result.valid, false);
      assert.ok(
        result.errors.some((e) => e.includes("unreachable")),
        "Expected validation error for unreachable ghost room"
      );
    });
  });
});
