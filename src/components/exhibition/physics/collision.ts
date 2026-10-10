/**
 * Artfolio Virtual Museum — 2D Continuous Collision Engine
 *
 * Pure TypeScript geometric collision detection & response.
 * Uses a continuous circular player collider on the XZ-plane moving among
 * solid museum walls, partitions, and interior furniture obstacles.
 *
 * Guaranteed:
 * - Frame-rate independent sub-stepping
 * - Zero wall tunneling (swept sub-stepping)
 * - Natural wall sliding without corner snagging
 * - Reversible from corners
 * - Doorways traversable in both directions
 * - Zero dependencies on React, Three.js rendering, or DOM APIs
 */

import { MUSEUM_CONFIG } from "@/components/exhibition/config/museum.config";
import type { MuseumConfig } from "@/components/exhibition/config/museum.config";

export interface Vector2 {
  x: number;
  z: number;
}

export interface AABB {
  id?: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  isObstacle?: boolean;
}

export interface CollisionResult {
  position: Vector2;
  velocity: Vector2;
  resolvedVelocity: Vector2;
  collided: boolean;
  contactNormals: Vector2[];
}

export interface CollisionConfig {
  playerRadius: number; // Standard: 0.35m
  maxSubStepDistance: number; // Max distance per sub-step to prevent tunneling: 0.12m
  maxIterationsPerStep: number; // Max relaxation iterations: 4
}

export const DEFAULT_COLLISION_CONFIG: CollisionConfig = {
  playerRadius: 0.35,
  maxSubStepDistance: 0.12,
  maxIterationsPerStep: 4,
};

/**
 * Museum Architectural Solid Colliders.
 * Derived from the authoritative museum.config.ts dimensions.
 * All partitions flanking doorways are split into flanking solid boxes,
 * leaving door openings 100% physically open and traversable.
 */
export function buildMuseumColliders(config: MuseumConfig = MUSEUM_CONFIG): AABB[] {
  const halfT = (config.constants.wallThickness || 0.3) / 2; // 0.15m half thickness
  return [
    // =========================================================================
    // 1. GRAND ENTRANCE GALLERY (Room 1)
    // =========================================================================
    // South exterior back wall (X: -8 to 8, Z = 30, T = 0.3)
    { id: "w-ent-south", minX: -8 - halfT, maxX: 8 + halfT, minZ: 30 - halfT, maxZ: 30 + halfT },
    // West exterior wall (Z: 18 to 30, X = -8, T = 0.3)
    { id: "w-ent-west", minX: -8 - halfT, maxX: -8 + halfT, minZ: 18.0, maxZ: 30 + halfT },
    // East wall (X = 8): North segment (Z: 18 to 21.8)
    { id: "w-ent-east-n", minX: 8 - halfT, maxX: 8 + halfT, minZ: 18.0, maxZ: 21.8 },
    // East wall (X = 8): South segment (Z: 24.0 to 30)
    { id: "w-ent-east-s", minX: 8 - halfT, maxX: 8 + halfT, minZ: 24.0, maxZ: 30 + halfT },
    // Doorway d-ent-east opening at X = 8: Z from 21.8 to 24.0 is OPEN!
    // Connector Hallway to East Wing (X: 8 to 10):
    // Connector North Enclosure Return Wall (Z: 21.65 to 21.95)
    { id: "w-ent-east-ret-n", minX: 8.0, maxX: 10 + halfT, minZ: 21.8 - halfT, maxZ: 21.8 + halfT },
    // Connector South Enclosure Return Wall (Z: 23.85 to 24.15)
    { id: "w-ent-east-ret-s", minX: 8.0, maxX: 10 + halfT, minZ: 24.0 - halfT, maxZ: 24.0 + halfT },

    // =========================================================================
    // 2. PARTITION: ENTRANCE <-> MAIN HALL (Z = 18)
    // Doorway d-ent-main at X = 0 (width 2.8m, open from X: -1.4 to 1.4)
    // =========================================================================
    { id: "partition-ent-main-w", minX: -10 - halfT, maxX: -1.4, minZ: 18 - halfT, maxZ: 18 + halfT },
    { id: "partition-ent-main-e", minX: 1.4, maxX: 10 + halfT, minZ: 18 - halfT, maxZ: 18 + halfT },

    // =========================================================================
    // 3. PARTITION: MAIN HALL <-> WEST GALLERY (X = -10)
    // Doorway d-main-west at Z = 6 (width 2.4m, open from Z: 4.8 to 7.2)
    // =========================================================================
    { id: "partition-main-west-n", minX: -10 - halfT, maxX: -10 + halfT, minZ: -6.0, maxZ: 4.8 },
    { id: "partition-main-west-s", minX: -10 - halfT, maxX: -10 + halfT, minZ: 7.2, maxZ: 18.0 },

    // =========================================================================
    // 4. PARTITION: MAIN HALL <-> EAST WING (X = 10)
    // Doorway d-main-east at Z = 6 (width 2.4m, open from Z: 4.8 to 7.2)
    // Passage into East Wing from Entrance connector open from Z: 21.8 to 24.0
    // =========================================================================
    { id: "partition-main-east-n", minX: 10 - halfT, maxX: 10 + halfT, minZ: -6.0, maxZ: 4.8 },
    { id: "partition-main-east-s", minX: 10 - halfT, maxX: 10 + halfT, minZ: 7.2, maxZ: 21.8 },

    // =========================================================================
    // 5. PARTITION: MAIN HALL <-> CENTRAL VESTIBULE (Z = -6)
    // Doorways:
    // - d-west-corridor at X: -12.1 to -9.9 is OPEN!
    // - d-main-corridor at X: -1.3 to 1.3 is OPEN!
    // - d-east-corridor at X: 9.9 to 12.1 is OPEN!
    // =========================================================================
    { id: "partition-main-corr-w", minX: -9.9, maxX: -1.3, minZ: -6 - halfT, maxZ: -6 + halfT },
    { id: "partition-main-corr-e", minX: 1.3, maxX: 9.9, minZ: -6 - halfT, maxZ: -6 + halfT },

    // =========================================================================
    // 6. WEST GALLERY PERIMETER WALLS (Room 3)
    // =========================================================================
    // South exterior wall (X: -26 to -10, Z = 15)
    { id: "w-west-south", minX: -26 - halfT, maxX: -10 + halfT, minZ: 15 - halfT, maxZ: 15 + halfT },
    // West exterior wall (Z: -3 to 15, X = -26)
    { id: "w-west-west", minX: -26 - halfT, maxX: -26 + halfT, minZ: -3.0, maxZ: 15 + halfT },
    // North exterior wall (X: -26 to -12, Z = -3)
    { id: "w-west-north", minX: -26 - halfT, maxX: -12.0, minZ: -3 - halfT, maxZ: -3 + halfT },
    // West Vestibule Connector Return Wall (X = -12, Z: -6 to -3)
    { id: "w-west-corr-ret", minX: -12 - halfT, maxX: -12 + halfT, minZ: -6.0, maxZ: -3.0 },

    // =========================================================================
    // 7. EAST WING PERIMETER WALLS (Room 4)
    // =========================================================================
    // South exterior wall (X: 10 to 26, Z = 24)
    { id: "w-east-south", minX: 10.0, maxX: 26 + halfT, minZ: 24 - halfT, maxZ: 24 + halfT },
    // East exterior wall (Z: -3 to 24, X = 26)
    { id: "w-east-east", minX: 26 - halfT, maxX: 26 + halfT, minZ: -3.0, maxZ: 24 + halfT },
    // North exterior wall (X: 12 to 26, Z = -3)
    { id: "w-east-north", minX: 12.0, maxX: 26 + halfT, minZ: -3 - halfT, maxZ: -3 + halfT },
    // East Vestibule Connector Return Wall (X = 12, Z: -6 to -3)
    { id: "w-east-corr-ret", minX: 12 - halfT, maxX: 12 + halfT, minZ: -6.0, maxZ: -3.0 },

    // =========================================================================
    // 8. CENTRAL CONNECTING VESTIBULE EXTERIOR WALLS (Room 5)
    // =========================================================================
    // West exterior wall (Z: -16 to -6, X = -12)
    { id: "w-corr-west", minX: -12 - halfT, maxX: -12 + halfT, minZ: -16.0, maxZ: -6.0 },
    // East exterior wall (Z: -16 to -6, X = 12)
    { id: "w-corr-east", minX: 12 - halfT, maxX: 12 + halfT, minZ: -16.0, maxZ: -6.0 },

    // =========================================================================
    // 9. PARTITION: VESTIBULE <-> FEATURED SANCTUARY (Z = -16)
    // Doorway d-corr-feat at X = 0 (width 3.0m, open from X: -1.5 to 1.5)
    // =========================================================================
    { id: "partition-corr-feat-w-out", minX: -12 - halfT, maxX: -9.0, minZ: -16 - halfT, maxZ: -16 + halfT },
    { id: "partition-corr-feat-w-in", minX: -9.0, maxX: -1.5, minZ: -16 - halfT, maxZ: -16 + halfT },
    { id: "partition-corr-feat-e-in", minX: 1.5, maxX: 9.0, minZ: -16 - halfT, maxZ: -16 + halfT },
    { id: "partition-corr-feat-e-out", minX: 9.0, maxX: 12 + halfT, minZ: -16 - halfT, maxZ: -16 + halfT },

    // =========================================================================
    // 10. FEATURED MASTERPIECE SANCTUARY PERIMETER WALLS (Room 6)
    // =========================================================================
    // West exterior wall (Z: -36 to -16, X = -9)
    { id: "w-feat-west", minX: -9 - halfT, maxX: -9 + halfT, minZ: -36 - halfT, maxZ: -16.0 },
    // East exterior wall (Z: -36 to -16, X = 9)
    { id: "w-feat-east", minX: 9 - halfT, maxX: 9 + halfT, minZ: -36 - halfT, maxZ: -16.0 },
    // North Apex focal wall (X: -9 to 9, Z = -36)
    { id: "w-feat-north-apex", minX: -9 - halfT, maxX: 9 + halfT, minZ: -36 - halfT, maxZ: -36 + halfT },

    // =========================================================================
    // 11. INTERIOR GALLERY SEATING OBSTACLES (Benches at Points of Interest)
    // =========================================================================
    // Main Hall central rotunda bench at [0, 0, 6] (size: 2.0m x 0.8m)
    { id: "bench-main", minX: -1.0, maxX: 1.0, minZ: 5.6, maxZ: 6.4, isObstacle: true },
    // West Gallery bench at [-18, 0, 6]
    { id: "bench-west", minX: -19.0, maxX: -17.0, minZ: 5.6, maxZ: 6.4, isObstacle: true },
    // East Wing bench at [18, 0, 6]
    { id: "bench-east", minX: 17.0, maxX: 19.0, minZ: 5.6, maxZ: 6.4, isObstacle: true },
    // Sanctuary viewing bench at [0, 0, -26]
    { id: "bench-feat", minX: -1.0, maxX: 1.0, minZ: -26.4, maxZ: -25.6, isObstacle: true },
  ];
}

export const MUSEUM_SOLID_OBSTACLES: AABB[] = buildMuseumColliders(MUSEUM_CONFIG);

/**
 * Resolves circle-AABB penetration for a single circular collider against a solid box.
 */
export function resolveCircleAABB(
  pos: Vector2,
  radius: number,
  box: AABB
): { resolved: Vector2; collided: boolean; normal: Vector2 } {
  // Clamped closest point on box to circle center
  const cx = Math.max(box.minX, Math.min(box.maxX, pos.x));
  const cz = Math.max(box.minZ, Math.min(box.maxZ, pos.z));

  const dx = pos.x - cx;
  const dz = pos.z - cz;
  const distSq = dx * dx + dz * dz;

  // Case 1: Circle center is outside box
  if (distSq > 0) {
    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      const penetration = radius - dist;
      const nx = dx / dist;
      const nz = dz / dist;

      return {
        resolved: {
          x: pos.x + nx * penetration,
          z: pos.z + nz * penetration,
        },
        collided: true,
        normal: { x: nx, z: nz },
      };
    }
    return { resolved: pos, collided: false, normal: { x: 0, z: 0 } };
  }

  // Case 2: Circle center is strictly inside the box (deep penetration recovery)
  const dWest = pos.x - box.minX;
  const dEast = box.maxX - pos.x;
  const dNorth = pos.z - box.minZ;
  const dSouth = box.maxZ - pos.z;

  const minDist = Math.min(dWest, dEast, dNorth, dSouth);

  let nx = 0;
  let nz = 0;
  const pushout = minDist + radius;

  if (minDist === dWest) {
    nx = -1;
  } else if (minDist === dEast) {
    nx = 1;
  } else if (minDist === dNorth) {
    nz = -1;
  } else {
    nz = 1;
  }

  return {
    resolved: {
      x: pos.x + nx * pushout,
      z: pos.z + nz * pushout,
    },
    collided: true,
    normal: { x: nx, z: nz },
  };
}

/**
 * Swept, continuous collision movement step.
 * Takes current position, requested movement velocity, delta time, and obstacle list.
 * Splits high-speed movement into sub-steps to guarantee zero wall tunneling.
 * Implements smooth sliding along collision surfaces.
 */
export function moveWithCollision(
  currentPos: Vector2,
  velocity: Vector2,
  deltaTime: number,
  obstacles: AABB[] = MUSEUM_SOLID_OBSTACLES,
  config: CollisionConfig = DEFAULT_COLLISION_CONFIG
): CollisionResult {
  if (deltaTime <= 0) {
    return {
      position: { ...currentPos },
      velocity: { ...velocity },
      resolvedVelocity: { ...velocity },
      collided: false,
      contactNormals: [],
    };
  }

  // Calculate total displacement vector
  const moveX = velocity.x * deltaTime;
  const moveZ = velocity.z * deltaTime;
  const totalDistance = Math.hypot(moveX, moveZ);

  // If stationary or practically zero movement, check static clearance
  if (totalDistance < 0.0001) {
    let resolved = { ...currentPos };
    let hasCollided = false;
    const normals: Vector2[] = [];

    for (let iter = 0; iter < config.maxIterationsPerStep; iter++) {
      let movedThisIter = false;
      for (const box of obstacles) {
        const res = resolveCircleAABB(resolved, config.playerRadius, box);
        if (res.collided) {
          resolved = res.resolved;
          hasCollided = true;
          movedThisIter = true;
          normals.push(res.normal);
        }
      }
      if (!movedThisIter) break;
    }

    return {
      position: resolved,
      velocity: { x: 0, z: 0 },
      resolvedVelocity: { x: 0, z: 0 },
      collided: hasCollided,
      contactNormals: normals,
    };
  }

  // Determine sub-steps for continuous anti-tunneling
  const subSteps = Math.max(
    1,
    Math.ceil(totalDistance / config.maxSubStepDistance)
  );
  const subDt = deltaTime / subSteps;

  let pos: Vector2 = { ...currentPos };
  const currentVel: Vector2 = { ...velocity };
  let anyCollided = false;
  const allNormals: Vector2[] = [];

  for (let s = 0; s < subSteps; s++) {
    // 1. Proposed advance for this sub-step
    const candidateX = pos.x + currentVel.x * subDt;
    const candidateZ = pos.z + currentVel.z * subDt;
    let candidate: Vector2 = { x: candidateX, z: candidateZ };

    // 2. Iterative relaxation against all solid obstacles
    for (let iter = 0; iter < config.maxIterationsPerStep; iter++) {
      let iterCollided = false;

      for (const box of obstacles) {
        const res = resolveCircleAABB(candidate, config.playerRadius, box);
        if (res.collided) {
          candidate = res.resolved;
          iterCollided = true;
          anyCollided = true;
          allNormals.push(res.normal);

          // Project velocity along the collision surface (sliding plane)
          const dot = currentVel.x * res.normal.x + currentVel.z * res.normal.z;
          if (dot < 0) {
            currentVel.x -= dot * res.normal.x;
            currentVel.z -= dot * res.normal.z;
          }
        }
      }

      if (!iterCollided) break;
    }

    pos = candidate;
  }

  return {
    position: pos,
    velocity: currentVel,
    resolvedVelocity: currentVel,
    collided: anyCollided,
    contactNormals: allNormals,
  };
}

/**
 * Checks whether a given position on the XZ-plane is valid, walkable, and not inside any solid wall.
 */
export function isPositionWalkable(
  pos: Vector2,
  radius: number = DEFAULT_COLLISION_CONFIG.playerRadius,
  obstacles: AABB[] = MUSEUM_SOLID_OBSTACLES
): boolean {
  for (const box of obstacles) {
    const cx = Math.max(box.minX, Math.min(box.maxX, pos.x));
    const cz = Math.max(box.minZ, Math.min(box.maxZ, pos.z));
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    if (dx * dx + dz * dz < radius * radius) {
      return false;
    }
  }
  return true;
}
