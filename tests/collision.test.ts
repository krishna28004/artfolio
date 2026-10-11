import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  moveWithCollision,
  isPositionWalkable,
  resolveCircleAABB,
  MUSEUM_SOLID_OBSTACLES,
  DEFAULT_COLLISION_CONFIG,
} from "../src/components/exhibition/physics/collision.ts";
import type { Vector2 } from "../src/components/exhibition/physics/collision.ts";
import { MUSEUM_CONFIG } from "../src/components/exhibition/config/museum.config.ts";

describe("Position-integrity collision regressions", () => {
  test("wall contact, sliding and retreat continue from the boundary, never spawn", () => {
    let position = { x: 3, z: 28.8 };
    for (let i = 0; i < 60; i++) position = moveWithCollision(position, { x: 0, z: 5.8 }, 1 / 60).position;
    assert.ok(position.z > 29.49 && position.z <= 29.501);
    assert.ok(Math.hypot(position.x, position.z - 27) > 3.8);
    const contact = { ...position };
    for (let i = 0; i < 30; i++) position = moveWithCollision(position, { x: 3, z: 3 }, 1 / 60).position;
    assert.ok(position.x > contact.x + 1.4);
    assert.ok(Math.abs(position.z - contact.z) < 1e-7);
    assert.ok(isPositionWalkable(position, 0.35 - 1e-7));
    const retreat = moveWithCollision(position, { x: 0, z: -3.5 }, 0.1);
    assert.ok(Math.abs(retreat.position.z - (position.z - 0.35)) < 1e-8);
    assert.ok(retreat.position.x === position.x);
  });

  for (const axis of ["x", "z"] as const) for (const sign of [-1, 1]) {
    test(`thin ${axis} wall blocks ${sign > 0 ? "positive" : "negative"} motion and allows parallel/away motion`, () => {
      const box = axis === "x"
        ? { minX: -0.15, maxX: 0.15, minZ: -10, maxZ: 10 }
        : { minX: -10, maxX: 10, minZ: -0.15, maxZ: 0.15 };
      const position = axis === "x" ? { x: -sign, z: 3 } : { x: 3, z: -sign };
      const velocity = axis === "x" ? { x: sign * 15, z: 0 } : { x: 0, z: sign * 15 };
      const contact = moveWithCollision(position, velocity, 0.5, [box]);
      assert.ok(Math.abs(contact.position[axis] + sign * 0.5) < 1e-7);
      assert.ok(isPositionWalkable(contact.position, 0.35 - 1e-7, [box]));
      const tangent = axis === "x" ? { x: 0, z: 2 } : { x: 2, z: 0 };
      const parallel = moveWithCollision(contact.position, tangent, 0.1, [box]);
      assert.ok(Math.abs(parallel.position[axis] - contact.position[axis]) < 1e-7);
      const away = moveWithCollision(parallel.position, { x: -velocity.x, z: -velocity.z }, 0.02, [box]);
      assert.ok(Math.abs(away.position[axis]) > 0.79);
    });
  }

  test("initial overlap and near-zero motion recover locally without a spawn fallback", () => {
    const wall = { minX: 10, maxX: 10.3, minZ: 0, maxZ: 10 };
    const result = moveWithCollision({ x: 9.9, z: 4 }, { x: 1e-10, z: 0 }, 0.05, [wall]);
    assert.ok(Math.abs(result.position.x - 9.65) < 1e-7);
    assert.equal(result.position.z, 4);
    assert.ok(isPositionWalkable(result.position, 0.35 - 1e-7, [wall]));
  });

  test("invalid velocities and timing preserve a non-spawn valid position and clear velocity", () => {
    const position = { x: 4, z: 10 };
    for (const [velocity, delta] of [
      [{ x: NaN, z: 2 }, 0.016], [{ x: Infinity, z: 0 }, 0.016],
      [{ x: 1, z: 1 }, NaN], [{ x: 1, z: 1 }, Infinity],
      [{ x: Number.MAX_VALUE, z: 0 }, Number.MAX_VALUE],
      [{ x: 1e300, z: 1e300 }, 0.016],
    ] as const) {
      const result = moveWithCollision(position, velocity, delta);
      assert.deepEqual(result.position, position);
      assert.deepEqual(result.resolvedVelocity, { x: 0, z: 0 });
      assert.ok(Object.values(result.position).every(Number.isFinite));
    }
    assert.throws(() => moveWithCollision({ x: NaN, z: 10 }, { x: 0, z: 0 }, 0.016), RangeError);
    assert.equal(isPositionWalkable({ x: Infinity, z: 10 }), false);
  });
});

describe("Artfolio Virtual Museum — Phase 2 Physics Collision & Movement Engine Tests", () => {
  const R = DEFAULT_COLLISION_CONFIG.playerRadius; // 0.35m

  describe("1. Stationary & Unobstructed Movement", () => {
    test("a stationary player remains stationary without input or drift", () => {
      const pos: Vector2 = { x: 0, z: 24 };
      const vel: Vector2 = { x: 0, z: 0 };
      const res = moveWithCollision(pos, vel, 0.016);
      assert.strictEqual(res.position.x, 0);
      assert.strictEqual(res.position.z, 24);
      assert.strictEqual(res.collided, false);
    });

    test("resolveCircleAABB pushes penetrating circle out along shortest axis", () => {
      const box = { minX: -1, maxX: 1, minZ: -1, maxZ: 1 };
      const circleCenter: Vector2 = { x: 0.9, z: 0 };
      const res = resolveCircleAABB(circleCenter, R, box);
      assert.strictEqual(res.collided, true);
      assert.ok(res.resolved.x >= 1 + R - 0.001);
    });

    test("movement in open space (center of Main Hall) is completely unobstructed", () => {
      const pos: Vector2 = { x: 0, z: 0 };
      const vel: Vector2 = { x: 0, z: -3.5 }; // walking forward
      const dt = 0.05;
      const res = moveWithCollision(pos, vel, dt);
      const expectedZ = 0 + -3.5 * dt;
      assert.ok(Math.abs(res.position.z - expectedZ) < 0.001);
      assert.strictEqual(res.position.x, 0);
      assert.strictEqual(res.collided, false);
    });
  });

  describe("2. Exterior Wall Containment & Anti-Penetration", () => {
    test("player cannot walk through South exterior wall (Entrance Z=30)", () => {
      let pos: Vector2 = { x: 0, z: 29.0 };
      const vel: Vector2 = { x: 0, z: 5.0 }; // walking South directly into wall
      for (let f = 0; f < 30; f++) {
        const res = moveWithCollision(pos, vel, 0.016);
        pos = res.position;
      }
      // Wall face is at Z = 30 - 0.15 = 29.85. Player center must stay <= 29.85 - 0.35 = 29.50
      assert.ok(
        pos.z <= 29.51,
        `Player penetrated South exterior wall: pos.z = ${pos.z}`
      );
    });

    test("player cannot walk through West exterior wall (West Gallery X=-26)", () => {
      let pos: Vector2 = { x: -24.5, z: 6.0 };
      const vel: Vector2 = { x: -6.0, z: 0 }; // sprinting West directly into wall
      for (let f = 0; f < 40; f++) {
        const res = moveWithCollision(pos, vel, 0.016);
        pos = res.position;
      }
      // Wall inner face is at X = -26 + 0.15 = -25.85. Player center must stay >= -25.85 + 0.35 = -25.50
      assert.ok(
        pos.x >= -25.51,
        `Player penetrated West exterior wall: pos.x = ${pos.x}`
      );
    });

    test("player cannot walk through East exterior wall (East Wing X=26)", () => {
      let pos: Vector2 = { x: 24.5, z: 6.0 };
      const vel: Vector2 = { x: 6.0, z: 0 }; // sprinting East directly into wall
      for (let f = 0; f < 40; f++) {
        const res = moveWithCollision(pos, vel, 0.016);
        pos = res.position;
      }
      // Wall inner face is at X = 26 - 0.15 = 25.85. Player center must stay <= 25.85 - 0.35 = 25.50
      assert.ok(
        pos.x <= 25.51,
        `Player penetrated East exterior wall: pos.x = ${pos.x}`
      );
    });

    test("player cannot walk through North Apex exterior wall (Sanctuary Z=-36)", () => {
      let pos: Vector2 = { x: 0, z: -34.5 };
      const vel: Vector2 = { x: 0, z: -6.0 }; // sprinting North directly into Apex wall
      for (let f = 0; f < 40; f++) {
        const res = moveWithCollision(pos, vel, 0.016);
        pos = res.position;
      }
      // Wall inner face is at Z = -36 + 0.15 = -35.85. Player center must stay >= -35.85 + 0.35 = -35.50
      assert.ok(
        pos.z >= -35.51,
        `Player penetrated North exterior wall: pos.z = ${pos.z}`
      );
    });
  });

  describe("3. Solid Internal Partitions & Doorway Traversability", () => {
    test("solid section of Z=18 partition blocks player when away from doorway (e.g. at X=5)", () => {
      let pos: Vector2 = { x: 5.0, z: 20.0 };
      const vel: Vector2 = { x: 0, z: -5.0 }; // Walking North toward partition at X=5
      for (let f = 0; f < 30; f++) {
        const res = moveWithCollision(pos, vel, 0.016);
        pos = res.position;
      }
      // Partition is at Z = 18. Face at Z = 18.15. Player must not cross Z = 18.15 - 0.35 = 17.80
      assert.ok(
        pos.z >= 18.15 + R - 0.01,
        `Player crossed solid internal partition: pos.z = ${pos.z}`
      );
    });

    test("all 8 configured doorways can be traversed North/South or East/West in BOTH directions", () => {
      const doorwayChecks = [
        {
          id: "d-ent-main",
          startFwd: { x: 0, z: 20 },
          velFwd: { x: 0, z: -4 },
          targetZFwd: 16,
          startRev: { x: 0, z: 16 },
          velRev: { x: 0, z: 4 },
          targetZRev: 20,
        },
        {
          id: "d-main-corridor",
          startFwd: { x: 0, z: -4 },
          velFwd: { x: 0, z: -4 },
          targetZFwd: -8,
          startRev: { x: 0, z: -8 },
          velRev: { x: 0, z: 4 },
          targetZRev: -4,
        },
        {
          id: "d-corr-feat",
          startFwd: { x: 0, z: -14 },
          velFwd: { x: 0, z: -4 },
          targetZFwd: -18,
          startRev: { x: 0, z: -18 },
          velRev: { x: 0, z: 4 },
          targetZRev: -14,
        },
        {
          id: "d-main-west",
          startFwd: { x: -8, z: 6 },
          velFwd: { x: -4, z: 0 },
          targetXFwd: -12,
          startRev: { x: -12, z: 6 },
          velRev: { x: 4, z: 0 },
          targetXRev: -8,
        },
        {
          id: "d-main-east",
          startFwd: { x: 8, z: 6 },
          velFwd: { x: 4, z: 0 },
          targetXFwd: 12,
          startRev: { x: 12, z: 6 },
          velRev: { x: -4, z: 0 },
          targetXRev: 8,
        },
        {
          id: "d-west-corridor",
          startFwd: { x: -11, z: -2 },
          velFwd: { x: 0, z: -4 },
          targetZFwd: -7,
          startRev: { x: -11, z: -7 },
          velRev: { x: 0, z: 4 },
          targetZRev: -2,
        },
        {
          id: "d-east-corridor",
          startFwd: { x: 11, z: -2 },
          velFwd: { x: 0, z: -4 },
          targetZFwd: -7,
          startRev: { x: 11, z: -7 },
          velRev: { x: 0, z: 4 },
          targetZRev: -2,
        },
        {
          id: "d-ent-east",
          startFwd: { x: 6, z: 22.9 },
          velFwd: { x: 4, z: 0 },
          targetXFwd: 11,
          startRev: { x: 11, z: 22.9 },
          velRev: { x: -4, z: 0 },
          targetXRev: 6,
        },
      ];

      for (const d of doorwayChecks) {
        // Forward crossing
        let posFwd = { ...d.startFwd };
        for (let i = 0; i < 70; i++) {
          const res = moveWithCollision(posFwd, d.velFwd, 0.02);
          posFwd = res.position;
        }
        if (d.targetZFwd !== undefined) {
          const passedZ = d.velFwd.z < 0 ? posFwd.z <= d.targetZFwd : posFwd.z >= d.targetZFwd;
          assert.ok(passedZ, `Doorway ${d.id} forward traversal failed: Z=${posFwd.z}`);
        }
        if (d.targetXFwd !== undefined) {
          const passedX = d.velFwd.x < 0 ? posFwd.x <= d.targetXFwd : posFwd.x >= d.targetXFwd;
          assert.ok(passedX, `Doorway ${d.id} forward traversal failed: X=${posFwd.x}`);
        }

        // Reverse crossing
        let posRev = { ...d.startRev };
        for (let i = 0; i < 70; i++) {
          const res = moveWithCollision(posRev, d.velRev, 0.02);
          posRev = res.position;
        }
        if (d.targetZRev !== undefined) {
          const passedZ = d.velRev.z < 0 ? posRev.z <= d.targetZRev : posRev.z >= d.targetZRev;
          assert.ok(passedZ, `Doorway ${d.id} reverse traversal failed: Z=${posRev.z}`);
        }
        if (d.targetXRev !== undefined) {
          const passedX = d.velRev.x < 0 ? posRev.x <= d.targetXRev : posRev.x >= d.targetXRev;
          assert.ok(passedX, `Doorway ${d.id} reverse traversal failed: X=${posRev.x}`);
        }
      }
    });

    test("doorway edge clearance: player walks safely near jamb edge within opening", () => {
      // d-ent-main is at X: [-1.4, 1.4]. Half-width 1.4m.
      // Walk forward at X = 0.9 (comfortably inside clearance, near eastern jamb)
      let pos: Vector2 = { x: 0.9, z: 20 };
      const vel: Vector2 = { x: 0, z: -4 };
      for (let i = 0; i < 60; i++) {
        const res = moveWithCollision(pos, vel, 0.016);
        pos = res.position;
      }
      assert.ok(pos.z < 17, `Player failed to pass near door edge: pos.z = ${pos.z}`);
    });
  });

  describe("4. Wall Sliding, Corner Recovery & Anti-Tunneling", () => {
    test("diagonal movement into a wall slides smoothly rather than stopping", () => {
      // Walk into South wall at 45 degree angle: Vx = 3.0, Vz = 3.0
      let pos: Vector2 = { x: 0, z: 28.5 };
      const vel: Vector2 = { x: 3.0, z: 3.0 };
      for (let i = 0; i < 30; i++) {
        const res = moveWithCollision(pos, vel, 0.016);
        pos = res.position;
      }
      // Wall stops Z movement, but X movement continues sliding East!
      assert.ok(pos.x > 1.0, `Player did not slide along wall: pos.x = ${pos.x}`);
      assert.ok(pos.z <= 29.51);
    });

    test("corners do not trap player; player can reverse out smoothly", () => {
      // Push into corner of Entrance (X = -7.5, Z = 29.5)
      let pos: Vector2 = { x: -7.0, z: 29.0 };
      const velIntoCorner: Vector2 = { x: -4.0, z: 4.0 };
      for (let i = 0; i < 30; i++) {
        const res = moveWithCollision(pos, velIntoCorner, 0.016);
        pos = res.position;
      }
      // Now reverse away from corner: Vx = 4.0, Vz = -4.0
      const velReverse: Vector2 = { x: 4.0, z: -4.0 };
      for (let i = 0; i < 30; i++) {
        const res = moveWithCollision(pos, velReverse, 0.016);
        pos = res.position;
      }
      assert.ok(pos.x > -6.0, `Player trapped in corner on X: pos.x = ${pos.x}`);
      assert.ok(pos.z < 28.0, `Player trapped in corner on Z: pos.z = ${pos.z}`);
    });

    test("high-speed sprint (15 m/s) cannot tunnel through any thin 0.3m wall", () => {
      // Test extreme velocity pushing directly through a 0.3m partition
      const pos: Vector2 = { x: 5.0, z: 18.6 };
      const extremeVel: Vector2 = { x: 0, z: -15.0 }; // 15 m/s sprint
      const dt = 0.05; // Large frame delta (20 FPS)
      const res = moveWithCollision(pos, extremeVel, dt);

      // Should be blocked and not tunnel to z < 18
      assert.ok(
        res.position.z >= 18.15 + R - 0.01,
        `High-speed sprint tunneled through partition: z = ${res.position.z}`
      );
    });

    test("produces zero NaN or Infinite coordinates under extreme inputs", () => {
      const pos: Vector2 = { x: 0, z: 0 };
      const vel: Vector2 = { x: 1e5, z: 1e5 };
      const res = moveWithCollision(pos, vel, 0.016);
      assert.ok(Number.isFinite(res.position.x));
      assert.ok(Number.isFinite(res.position.z));
      assert.ok(!Number.isNaN(res.position.x));
      assert.ok(!Number.isNaN(res.position.z));
    });
  });

  describe("5. Spawn Point Validity & Walkability Verification", () => {
    test("museum spawn point [0, 1.65, 27] is completely walkable and free of obstacle overlaps", () => {
      const [sx, , sz] = MUSEUM_CONFIG.spawn.position;
      const spawnPos: Vector2 = { x: sx, z: sz };
      const isWalkable = isPositionWalkable(spawnPos, R, MUSEUM_SOLID_OBSTACLES);
      assert.strictEqual(
        isWalkable,
        true,
        `Spawn position [${sx}, ${sz}] collides with a solid wall obstacle!`
      );
    });
  });

  describe("6. Frame-Rate Independence Simulation (30 vs 60 vs 144 FPS)", () => {
    test("simulated movement distance variation across 30, 60, and 144 FPS is less than 2%", () => {
      const targetDuration = 1.0; // 1 second
      const speed = 3.5; // 3.5 m/s

      function simulateRun(fps: number): number {
        const dt = 1.0 / fps;
        const totalFrames = Math.round(targetDuration * fps);
        let pos: Vector2 = { x: 0, z: 10 };
        const vel: Vector2 = { x: 0, z: -speed };

        for (let i = 0; i < totalFrames; i++) {
          const res = moveWithCollision(pos, vel, dt);
          pos = res.position;
        }
        return Math.abs(pos.z - 10);
      }

      const dist30 = simulateRun(30);
      const dist60 = simulateRun(60);
      const dist144 = simulateRun(144);

      const maxDiff = Math.max(
        Math.abs(dist30 - dist60),
        Math.abs(dist60 - dist144),
        Math.abs(dist30 - dist144)
      );

      const percentDiff = (maxDiff / dist60) * 100;
      assert.ok(
        percentDiff < 2.0,
        `FPS distance variation exceeds 2%: got ${percentDiff.toFixed(2)}% (30fps: ${dist30.toFixed(4)}, 60fps: ${dist60.toFixed(4)}, 144fps: ${dist144.toFixed(4)})`
      );
    });

    test("walking and sprint speeds produce expected displacement ratios", () => {
      const walkSpeed = 3.5;
      const sprintSpeed = 5.8;
      const dt = 0.02;

      // Unobstructed 1s walk in Main Hall at X=4 (benches are at X=0)
      let posWalk: Vector2 = { x: 4, z: 10 };
      for (let i = 0; i < 50; i++) {
        posWalk = moveWithCollision(posWalk, { x: 0, z: -walkSpeed }, dt).position;
      }
      const distWalk = Math.abs(posWalk.z - 10);

      // Unobstructed 1s sprint in Main Hall at X=4
      let posSprint: Vector2 = { x: 4, z: 10 };
      for (let i = 0; i < 50; i++) {
        posSprint = moveWithCollision(posSprint, { x: 0, z: -sprintSpeed }, dt).position;
      }
      const distSprint = Math.abs(posSprint.z - 10);

      assert.ok(Math.abs(distWalk - 3.5) < 0.05, `Walk distance expected ~3.5m, got ${distWalk}`);
      assert.ok(Math.abs(distSprint - 5.8) < 0.05, `Sprint distance expected ~5.8m, got ${distSprint}`);
      const ratio = distSprint / distWalk;
      assert.ok(Math.abs(ratio - sprintSpeed / walkSpeed) < 0.02, `Ratio expected ~1.657, got ${ratio}`);
    });

    test("diagonal movement is normalized and cannot exceed straight-line speed", () => {
      const speed = 3.5;
      const dt = 0.02;

      // Un-normalized diagonal would be speed * sqrt(2)
      // Correct game-feel normalized diagonal is dir / length * speed
      const rawDir = { x: 1, z: -1 };
      const mag = Math.sqrt(rawDir.x * rawDir.x + rawDir.z * rawDir.z);
      const normalizedVel: Vector2 = {
        x: (rawDir.x / mag) * speed,
        z: (rawDir.z / mag) * speed,
      };

      let posDiag: Vector2 = { x: 4, z: 10 };
      for (let i = 0; i < 50; i++) {
        posDiag = moveWithCollision(posDiag, normalizedVel, dt).position;
      }
      const diagDist = Math.sqrt(Math.pow(posDiag.x - 4, 2) + Math.pow(posDiag.z - 10, 2));

      // Must equal exact straight line distance 3.5m
      assert.ok(
        Math.abs(diagDist - 3.5) < 0.05,
        `Normalized diagonal distance should be 3.5m, got ${diagDist}`
      );
    });

    test("collision response remains stable under large simulation timesteps (dt = 0.05s and 0.1s)", () => {
      // Approach solid wall at high speed with large dt
      const largeDts = [0.05, 0.1];
      for (const dt of largeDts) {
        let pos: Vector2 = { x: 0, z: 28 }; // Heading south towards Z=30 wall
        const vel: Vector2 = { x: 0, z: 6.0 }; // Fast sprint
        for (let i = 0; i < Math.round(1.0 / dt); i++) {
          const res = moveWithCollision(pos, vel, dt);
          pos = res.position;
        }
        // South wall starts at minZ: 29.85. With radius R=0.35, player max allowed Z is 29.85 - 0.35 = 29.50
        assert.ok(
          pos.z <= 29.501,
          `At dt=${dt}, player penetrated South wall: Z=${pos.z} (allowed <= 29.50)`
        );
      }
    });

    test("full 6-room grand navigation loop traversal succeeds without obstacle trap", () => {
      // Traverse a complete circuit:
      // Room 1 (Entrance, [0, 24]) -> Room 2 (Main Hall, [3, 6]) ->
      // Room 3 (West Gallery, [-18, 2]) -> Room 5 (Vestibule, [0, -10]) ->
      // Room 6 (Sanctuary, [3, -26]) -> Room 5 (Vestibule, [0, -10]) ->
      // Room 4 (East Wing, [18, 2]) -> Room 2 (Main Hall, [3, 6]) ->
      // Room 1 (Entrance, [0, 24])
      const waypoints: Vector2[] = [
        { x: 0, z: 24 },    // 0: Room 1 (Entrance)
        { x: 0, z: 18 },    // 1: d-ent-main
        { x: 0, z: 12 },    // 2: Room 2 (Main Hall clear area)
        { x: -8, z: 12 },   // 3: Align with west hall
        { x: -8, z: 6 },    // 4: Approach d-main-west
        { x: -12, z: 6 },   // 5: Cross d-main-west into West Gallery
        { x: -18, z: 2 },   // 6: West Gallery
        { x: -11, z: -2 },  // 7: Approach d-west-corridor
        { x: -11, z: -8 },  // 8: Cross d-west-corridor
        { x: 0, z: -10 },   // 9: Room 5 (Vestibule)
        { x: 0, z: -18 },   // 10: Cross d-corr-feat
        { x: 0, z: -22 },   // 11: Room 6 (Sanctuary viewing area)
        { x: 0, z: -10 },   // 12: Return to Room 5 (Vestibule)
        { x: 11, z: -8 },   // 13: Approach d-east-corridor
        { x: 11, z: -2 },   // 14: Cross d-east-corridor
        { x: 18, z: 2 },    // 15: Room 4 (East Wing)
        { x: 12, z: 6 },    // 16: Approach d-main-east
        { x: 8, z: 6 },     // 17: Cross d-main-east into Main Hall
        { x: 8, z: 12 },    // 18: South of bench
        { x: 0, z: 12 },    // 19: Align with entrance portal
        { x: 0, z: 18 },    // 20: Cross d-ent-main
        { x: 0, z: 24 },    // 21: Return to Room 1
      ];

      let currentPos: Vector2 = { ...waypoints[0] };
      const speed = 4.0;
      const dt = 0.02;

      for (let w = 1; w < waypoints.length; w++) {
        const target = waypoints[w];
        let steps = 0;
        while (steps < 250) {
          const dx = target.x - currentPos.x;
          const dz = target.z - currentPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 0.2) break; // Reached waypoint

          const vel: Vector2 = {
            x: (dx / dist) * speed,
            z: (dz / dist) * speed,
          };
          const res = moveWithCollision(currentPos, vel, dt);
          currentPos = res.position;
          steps++;
        }

        const finalDist = Math.hypot(target.x - currentPos.x, target.z - currentPos.z);
        assert.ok(
          finalDist < 0.35,
          `Failed to reach waypoint ${w} (${target.x}, ${target.z}): reached (${currentPos.x.toFixed(2)}, ${currentPos.z.toFixed(2)}) after ${steps} steps`
        );
      }
    });
  });

  describe("7. Deterministic Random-Walk Fuzz Test", () => {
    test("pseudo-random exploration for 1000 steps never breaches solid walls or penetrates obstacles", () => {
      let seed = 123456789;
      function nextRandom() {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
      }

      let currentPos: Vector2 = { x: 0, z: 24 }; // Start in Entrance

      for (let step = 0; step < 1000; step++) {
        // Random heading and speed (up to sprint 6.0 m/s)
        const angle = nextRandom() * Math.PI * 2;
        const speed = 2.0 + nextRandom() * 4.0;
        const vel: Vector2 = {
          x: Math.cos(angle) * speed,
          z: Math.sin(angle) * speed,
        };

        const dt = 0.016 + nextRandom() * 0.016; // variable frame delta
        const res = moveWithCollision(currentPos, vel, dt);
        currentPos = res.position;

        // Verify player is never inside any solid obstacle
        const walkable = isPositionWalkable(currentPos, R - 0.02, MUSEUM_SOLID_OBSTACLES);
        assert.ok(
          walkable,
          `Player penetrated solid obstacle at step ${step}: pos = (${currentPos.x.toFixed(3)}, ${currentPos.z.toFixed(3)})`
        );
      }
    });
  });
});
