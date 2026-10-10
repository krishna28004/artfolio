"use client";

import React, { useMemo } from "react";
import * as THREE from "three";

export function MuseumCeiling() {
  const materials = useMemo(() => {
    return {
      soffitDark: new THREE.MeshStandardMaterial({
        color: "#181a1d",
        roughness: 0.9,
        metalness: 0.1,
      }),
      soffitMuted: new THREE.MeshStandardMaterial({
        color: "#1d1f22",
        roughness: 0.92,
        metalness: 0.05,
      }),
      soffitWarm: new THREE.MeshStandardMaterial({
        color: "#232220",
        roughness: 0.9,
        metalness: 0.05,
      }),
      skylightGlass: new THREE.MeshBasicMaterial({
        color: "#fff8eb",
      }),
      skylightMullion: new THREE.MeshStandardMaterial({
        color: "#111214",
        roughness: 0.4,
        metalness: 0.8,
      }),
      trackRail: new THREE.MeshStandardMaterial({
        color: "#0d0e10",
        roughness: 0.3,
        metalness: 0.85,
      }),
      spotFixture: new THREE.MeshStandardMaterial({
        color: "#151618",
        roughness: 0.35,
        metalness: 0.7,
      }),
      coveGlow: new THREE.MeshBasicMaterial({
        color: "#ffd9aa",
      }),
    };
  }, []);

  return (
    <group name="museum-ceilings">
      {/* ========================================================= */}
      {/* 1. ROOM 1: GRAND ENTRANCE GALLERY CEILING (Y = 4.8m)      */}
      {/* Bounds: X: -8 to 8 (w: 16), Z: 18 to 30 (d: 12)          */}
      {/* ========================================================= */}
      <mesh
        position={[0, 4.8, 24]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitDark}
      >
        <planeGeometry args={[16, 12]} />
      </mesh>

      {/* ========================================================= */}
      {/* 2. ROOM 3: WEST GALLERY CEILING (Y = 4.5m)                */}
      {/* Bounds: X: -26 to -10 (w: 16), Z: -3 to 15 (d: 18)       */}
      {/* ========================================================= */}
      <mesh
        position={[-18, 4.5, 6]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitMuted}
      >
        <planeGeometry args={[16, 18]} />
      </mesh>

      {/* ========================================================= */}
      {/* 3. ROOM 4: EAST WING CEILING (Y = 4.5m)                   */}
      {/* Bounds: X: 10 to 26 (w: 16), Z: -3 to 24 (d: 27)         */}
      {/* ========================================================= */}
      <mesh
        position={[18, 4.5, 10.5]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitMuted}
      >
        <planeGeometry args={[16, 27]} />
      </mesh>

      {/* ========================================================= */}
      {/* 4. ROOM 5: CENTRAL CONNECTING VESTIBULE CEILING (Y = 4.8m) */}
      {/* Bounds: X: -12 to 12 (w: 24), Z: -16 to -6 (d: 10)       */}
      {/* ========================================================= */}
      <mesh
        position={[0, 4.8, -11]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitWarm}
      >
        <planeGeometry args={[24, 10]} />
      </mesh>

      {/* Connector Passages Ceilings */}
      {/* West Vestibule Connector: X: -12 to -10, Z: -6 to -3 */}
      <mesh
        position={[-11, 4.5, -4.5]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitWarm}
      >
        <planeGeometry args={[2, 3]} />
      </mesh>
      {/* East Vestibule Connector: X: 10 to 12, Z: -6 to -3 */}
      <mesh
        position={[11, 4.5, -4.5]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitWarm}
      >
        <planeGeometry args={[2, 3]} />
      </mesh>
      {/* Entrance-East Connector: X: 8 to 10, Z: 22.8 to 25.2 */}
      <mesh
        position={[9, 4.5, 24]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitWarm}
      >
        <planeGeometry args={[2, 2.4]} />
      </mesh>

      {/* ========================================================= */}
      {/* 5. ROOM 6: FEATURED MASTERPIECE SANCTUARY (Y = 5.2m)      */}
      {/* Bounds: X: -9 to 9 (w: 18), Z: -36 to -16 (d: 20)        */}
      {/* ========================================================= */}
      <mesh
        position={[0, 5.2, -26]}
        rotation={[Math.PI / 2, 0, 0]}
        material={materials.soffitDark}
      >
        <planeGeometry args={[18, 20]} />
      </mesh>
      {/* Sanctuary Perimeter Architectural Soffit Trim */}
      <group position={[0, 5.18, -26]}>
        <mesh position={[0, 0, -8]} material={materials.soffitDark}>
          <boxGeometry args={[14, 0.08, 0.2]} />
        </mesh>
        <mesh position={[0, 0, 8]} material={materials.soffitDark}>
          <boxGeometry args={[14, 0.08, 0.2]} />
        </mesh>
        <mesh position={[-7, 0, 0]} material={materials.soffitDark}>
          <boxGeometry args={[0.2, 0.08, 16]} />
        </mesh>
        <mesh position={[7, 0, 0]} material={materials.soffitDark}>
          <boxGeometry args={[0.2, 0.08, 16]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 6. ROOM 2: MAIN EXHIBITION HALL — ARCHITECTURAL SKYLIGHT  */}
      {/* Total bounds: X: -10 to 10 (w: 20), Z: -6 to 18 (d: 24)  */}
      {/* Central Recessed Coffer Well: X: -6 to 6, Z: -2 to 14     */}
      {/* Recess Elevation: Y = 5.2m to 5.8m (Height: 0.6m)         */}
      {/* ========================================================= */}
      <group name="main-hall-coffer-skylight">
        {/* Perimeter Soffit at Y = 5.2m */}
        {/* North Soffit (Z: -6 to -2, w: 20, d: 4) */}
        <mesh
          position={[0, 5.2, -4]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.soffitDark}
        >
          <planeGeometry args={[20, 4]} />
        </mesh>
        {/* South Soffit (Z: 14 to 18, w: 20, d: 4) */}
        <mesh
          position={[0, 5.2, 16]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.soffitDark}
        >
          <planeGeometry args={[20, 4]} />
        </mesh>
        {/* West Soffit (X: -10 to -6, w: 4, Z: -2 to 14, d: 16) */}
        <mesh
          position={[-8, 5.2, 6]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.soffitDark}
        >
          <planeGeometry args={[4, 16]} />
        </mesh>
        {/* East Soffit (X: 6 to 10, w: 4, Z: -2 to 14, d: 16) */}
        <mesh
          position={[8, 5.2, 6]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.soffitDark}
        >
          <planeGeometry args={[4, 16]} />
        </mesh>

        {/* Recessed Coffer Well Vertical Riser Walls (Y: 5.2 to 5.8, H: 0.6) */}
        {/* North Riser (Z = -2, X: -6 to 6) */}
        <mesh
          position={[0, 5.5, -2]}
          material={materials.soffitDark}
        >
          <boxGeometry args={[12, 0.6, 0.1]} />
        </mesh>
        {/* South Riser (Z = 14, X: -6 to 6) */}
        <mesh
          position={[0, 5.5, 14]}
          material={materials.soffitDark}
        >
          <boxGeometry args={[12, 0.6, 0.1]} />
        </mesh>
        {/* West Riser (X = -6, Z: -2 to 14) */}
        <mesh
          position={[-6, 5.5, 6]}
          material={materials.soffitDark}
        >
          <boxGeometry args={[0.1, 0.6, 16]} />
        </mesh>
        {/* East Riser (X = 6, Z: -2 to 14) */}
        <mesh
          position={[6, 5.5, 6]}
          material={materials.soffitDark}
        >
          <boxGeometry args={[0.1, 0.6, 16]} />
        </mesh>

        {/* Frosted Illuminated Skylight Panel at Y = 5.8m */}
        <mesh
          position={[0, 5.8, 6]}
          rotation={[Math.PI / 2, 0, 0]}
          material={materials.skylightGlass}
        >
          <planeGeometry args={[12, 16]} />
        </mesh>

        {/* Architectural Metal Mullion Grid dividing into classical coffers */}
        {/* Longitudinal Mullions (X = -3, 0, 3, along Z: -2 to 14) */}
        {[-3, 0, 3].map((x) => (
          <mesh
            key={`mullion-long-${x}`}
            position={[x, 5.78, 6]}
            material={materials.skylightMullion}
          >
            <boxGeometry args={[0.12, 0.05, 16]} />
          </mesh>
        ))}
        {/* Transverse Mullions (Z = 2, 6, 10, along X: -6 to 6) */}
        {[2, 6, 10].map((z) => (
          <mesh
            key={`mullion-trans-${z}`}
            position={[0, 5.78, z]}
            material={materials.skylightMullion}
          >
            <boxGeometry args={[12, 0.05, 0.12]} />
          </mesh>
        ))}

        {/* Suspended Museum Track Lighting System */}
        {/* West Track Rail (X = -3.8, Y = 4.8m, Z: -2 to 14) */}
        <group position={[-3.8, 4.8, 6]}>
          <mesh material={materials.trackRail}>
            <boxGeometry args={[0.08, 0.06, 16]} />
          </mesh>
          {/* Vertical Hanger Stems */}
          {[-6, 0, 6].map((zHanger) => (
            <mesh
              key={`hanger-w-${zHanger}`}
              position={[0, 0.2, zHanger]}
              material={materials.trackRail}
            >
              <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
            </mesh>
          ))}
          {/* Spotlight Canister Fixtures */}
          {[-5, -2, 1, 4, 7].map((zSpot) => (
            <mesh
              key={`spot-w-${zSpot}`}
              position={[-0.08, -0.08, zSpot]}
              rotation={[0, 0, -Math.PI / 6]}
              material={materials.spotFixture}
            >
              <cylinderGeometry args={[0.04, 0.05, 0.14, 12]} />
            </mesh>
          ))}
        </group>

        {/* East Track Rail (X = 3.8, Y = 4.8m, Z: -2 to 14) */}
        <group position={[3.8, 4.8, 6]}>
          <mesh material={materials.trackRail}>
            <boxGeometry args={[0.08, 0.06, 16]} />
          </mesh>
          {/* Vertical Hanger Stems */}
          {[-6, 0, 6].map((zHanger) => (
            <mesh
              key={`hanger-e-${zHanger}`}
              position={[0, 0.2, zHanger]}
              material={materials.trackRail}
            >
              <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
            </mesh>
          ))}
          {/* Spotlight Canister Fixtures */}
          {[-5, -2, 1, 4, 7].map((zSpot) => (
            <mesh
              key={`spot-e-${zSpot}`}
              position={[0.08, -0.08, zSpot]}
              rotation={[0, 0, Math.PI / 6]}
              material={materials.spotFixture}
            >
              <cylinderGeometry args={[0.04, 0.05, 0.14, 12]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}
