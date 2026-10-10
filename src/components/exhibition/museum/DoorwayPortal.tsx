"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { MUSEUM_CONFIG } from "../config/museum.config";

export function DoorwayPortal() {
  const materials = useMemo(() => {
    return {
      darkCasing: new THREE.MeshStandardMaterial({
        color: "#18191b",
        roughness: 0.6,
        metalness: 0.2,
      }),
      bronzeAccent: new THREE.MeshStandardMaterial({
        color: "#94763c",
        roughness: 0.35,
        metalness: 0.75,
      }),
      walnutTrim: new THREE.MeshStandardMaterial({
        color: "#241e19",
        roughness: 0.55,
        metalness: 0.1,
      }),
      stoneArchitrave: new THREE.MeshStandardMaterial({
        color: "#2a2927",
        roughness: 0.75,
        metalness: 0.15,
      }),
    };
  }, []);

  const doorways = MUSEUM_CONFIG.doorways;

  return (
    <group name="doorway-portals">
      {doorways.map((door) => {
        const [dx, , dz] = door.position;
        const isEW = Math.abs(door.normal[0]) > 0.5; // Normal along X-axis
        const isGrandPortal = door.id === "d-ent-main" || door.id === "d-corr-feat";

        const halfWidth = door.width / 2;
        const wallThick = 0.3;
        const jambWidth = 0.14;
        const jambDepth = wallThick + 0.08; // 0.38m (protrudes 4cm beyond wall on each side)
        const lintelHeight = 0.18;

        if (isEW) {
          // Doorway normal is along X (doorway runs along Z-axis)
          const zSouth = dz + halfWidth;
          const zNorth = dz - halfWidth;

          return (
            <group key={`portal-${door.id}`} name={`portal-${door.id}`}>
              {/* North Jamb */}
              <mesh
                position={[dx, door.height / 2, zNorth]}
                material={materials.darkCasing}
                castShadow
              >
                <boxGeometry args={[jambDepth, door.height, jambWidth]} />
              </mesh>

              {/* South Jamb */}
              <mesh
                position={[dx, door.height / 2, zSouth]}
                material={materials.darkCasing}
                castShadow
              >
                <boxGeometry args={[jambDepth, door.height, jambWidth]} />
              </mesh>

              {/* Lintel Header */}
              <mesh
                position={[dx, door.height + lintelHeight / 2, dz]}
                material={materials.darkCasing}
                castShadow
              >
                <boxGeometry
                  args={[jambDepth + 0.04, lintelHeight, door.width + jambWidth * 2]}
                />
              </mesh>

              {/* Bronze Trim Inlay */}
              <mesh
                position={[dx, door.height + lintelHeight + 0.02, dz]}
                material={materials.bronzeAccent}
              >
                <boxGeometry
                  args={[jambDepth + 0.06, 0.04, door.width + jambWidth * 2 + 0.04]}
                />
              </mesh>
            </group>
          );
        }

        // Doorway normal is along Z (doorway runs along X-axis)
        const xWest = dx - halfWidth;
        const xEast = dx + halfWidth;

        return (
          <group key={`portal-${door.id}`} name={`portal-${door.id}`}>
            {/* West Jamb */}
            <mesh
              position={[xWest, door.height / 2, dz]}
              material={materials.darkCasing}
              castShadow
            >
              <boxGeometry args={[jambWidth, door.height, jambDepth]} />
            </mesh>

            {/* East Jamb */}
            <mesh
              position={[xEast, door.height / 2, dz]}
              material={materials.darkCasing}
              castShadow
            >
              <boxGeometry args={[jambWidth, door.height, jambDepth]} />
            </mesh>

            {/* Lintel Header */}
            <mesh
              position={[dx, door.height + lintelHeight / 2, dz]}
              material={materials.darkCasing}
              castShadow
            >
              <boxGeometry
                args={[door.width + jambWidth * 2, lintelHeight, jambDepth + 0.04]}
              />
            </mesh>

            {/* Bronze Trim Inlay */}
            <mesh
              position={[dx, door.height + lintelHeight + 0.02, dz]}
              material={materials.bronzeAccent}
            >
              <boxGeometry
                args={[door.width + jambWidth * 2 + 0.04, 0.04, jambDepth + 0.06]}
              />
            </mesh>

            {/* Grand Portals: Classical Pediment / Arch Header Detail */}
            {isGrandPortal && (
              <group position={[dx, door.height + lintelHeight + 0.25, dz]}>
                {/* Stepped Cornice Overdoor */}
                <mesh material={materials.stoneArchitrave} castShadow>
                  <boxGeometry
                    args={[door.width + jambWidth * 2 + 0.2, 0.25, jambDepth + 0.08]}
                  />
                </mesh>
                {/* Antique Bronze Crown Moulding Band */}
                <mesh
                  position={[0, 0.15, 0]}
                  material={materials.bronzeAccent}
                >
                  <boxGeometry
                    args={[door.width + jambWidth * 2 + 0.24, 0.05, jambDepth + 0.1]}
                  />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}
