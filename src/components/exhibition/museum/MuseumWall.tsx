"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import {
  MUSEUM_CONFIG,
  WallTheme,
} from "../config/museum.config";

interface MuseumWallProps {
  themeOverride?: WallTheme;
}

export function MuseumWall({}: MuseumWallProps = {}) {
  // Reusable PBR Wall & Skirting Materials
  const materials = useMemo(() => {
    return {
      "charcoal-matte": new THREE.MeshStandardMaterial({
        color: "#212326",
        roughness: 0.88,
        metalness: 0.04,
      }),
      "deep-slate": new THREE.MeshStandardMaterial({
        color: "#181a1d",
        roughness: 0.85,
        metalness: 0.08,
      }),
      "muted-teal": new THREE.MeshStandardMaterial({
        color: "#1a2527",
        roughness: 0.88,
        metalness: 0.05,
      }),
      "warm-grey": new THREE.MeshStandardMaterial({
        color: "#2c2a27",
        roughness: 0.9,
        metalness: 0.03,
      }),
      skirting: new THREE.MeshStandardMaterial({
        color: "#121314",
        roughness: 0.45,
        metalness: 0.25,
      }),
      accentTrim: new THREE.MeshStandardMaterial({
        color: "#26231f",
        roughness: 0.5,
        metalness: 0.4,
      }),
    };
  }, []);

  const wallThickness = MUSEUM_CONFIG.constants.wallThickness; // 0.3m
  const skirtingHeight = 0.28;
  const skirtingThickness = wallThickness + 0.05; // 0.35m (protrudes 2.5cm on each face)

  return (
    <group name="museum-walls">
      {/* ========================================================= */}
      {/* 1. ROOM 1: GRAND ENTRANCE GALLERY WALLS (H = 4.8m)        */}
      {/* ========================================================= */}
      {/* South Wall: w-ent-s (X: -8 to 8, Z = 30) */}
      <group name="wall-ent-south">
        <mesh
          position={[0, 2.4, 30]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[16 + wallThickness, 4.8, wallThickness]} />
        </mesh>
        {/* Dark Stone Skirting */}
        <mesh
          position={[0, skirtingHeight / 2, 30]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[16, skirtingHeight, skirtingThickness]} />
        </mesh>
      </group>

      {/* West Wall: w-ent-w (Z: 18 to 30, X = -8) */}
      <group name="wall-ent-west">
        <mesh
          position={[-8, 2.4, 24]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.8, 12]} />
        </mesh>
        <mesh
          position={[-8, skirtingHeight / 2, 24]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 12]} />
        </mesh>
      </group>

      {/* East Wall: w-ent-e (Z: 18 to 30, X = 8) with Doorway d-ent-east (Z: 21.8 to 24.0) */}
      <group name="wall-ent-east">
        {/* North segment (Z: 18 to 21.8, len: 3.8) */}
        <mesh
          position={[8, 2.4, 19.9]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.8, 3.8]} />
        </mesh>
        <mesh
          position={[8, skirtingHeight / 2, 19.9]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 3.8]} />
        </mesh>

        {/* South segment (Z: 24.0 to 30, len: 6.0) */}
        <mesh
          position={[8, 2.4, 27.0]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.8, 6.0]} />
        </mesh>
        <mesh
          position={[8, skirtingHeight / 2, 27.0]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 6.0]} />
        </mesh>

        {/* Header lintel above d-ent-east (Z: 21.8 to 24.0, Y: 3.2 to 4.8) */}
        <mesh
          position={[8, 4.0, 22.9]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 1.6, 2.2]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 2. SHARED PARTITION: ENTRANCE <-> MAIN HALL (Z = 18)     */}
      {/* Deduplicated: w-main-s and w-ent-n unified. H = 5.2m      */}
      {/* Doorway d-ent-main at X = 0 (width: 2.8, height: 3.6)     */}
      {/* Opening spans X: -1.4 to 1.4                              */}
      {/* ========================================================= */}
      <group name="partition-entrance-main">
        {/* West segment: X: -10 to -1.4 (len: 8.6) */}
        <mesh
          position={[-5.7, 2.6, 18]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[8.6, 5.2, wallThickness]} />
        </mesh>
        <mesh
          position={[-5.7, skirtingHeight / 2, 18]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[8.6, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* East segment: X: 1.4 to 10 (len: 8.6) */}
        <mesh
          position={[5.7, 2.6, 18]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[8.6, 5.2, wallThickness]} />
        </mesh>
        <mesh
          position={[5.7, skirtingHeight / 2, 18]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[8.6, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* Header lintel above d-ent-main (X: -1.4 to 1.4, Y: 3.6 to 5.2) */}
        <mesh
          position={[0, 4.4, 18]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.8, 1.6, wallThickness]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 3. SHARED PARTITION: MAIN HALL <-> WEST SALON (X = -10)   */}
      {/* Deduplicated: w-main-w and w-west-e unified. H = 5.2m     */}
      {/* Doorway d-main-west at Z = 6 (width: 2.4, height: 3.2)    */}
      {/* Opening spans Z: 4.8 to 7.2. Total wall Z: -6 to 18       */}
      {/* ========================================================= */}
      <group name="partition-main-west">
        {/* North segment: Z: -6 to 4.8 (len: 10.8) */}
        <mesh
          position={[-10, 2.6, -0.6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 5.2, 10.8]} />
        </mesh>
        <mesh
          position={[-10, skirtingHeight / 2, -0.6]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 10.8]} />
        </mesh>

        {/* South segment: Z: 7.2 to 18 (len: 10.8) */}
        <mesh
          position={[-10, 2.6, 12.6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 5.2, 10.8]} />
        </mesh>
        <mesh
          position={[-10, skirtingHeight / 2, 12.6]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 10.8]} />
        </mesh>

        {/* Header lintel above d-main-west (Z: 4.8 to 7.2, Y: 3.2 to 5.2) */}
        <mesh
          position={[-10, 4.2, 6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 2.0, 2.4]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 4. SHARED PARTITION: MAIN HALL <-> EAST WING (X = 10)     */}
      {/* Deduplicated: w-main-e and w-east-w unified. H = 5.2m     */}
      {/* Doorway d-main-east at Z = 6 (width: 2.4, height: 3.2)    */}
      {/* Opening spans Z: 4.8 to 7.2. Total wall Z: -6 to 24       */}
      {/* ========================================================= */}
      <group name="partition-main-east">
        {/* North segment: Z: -6 to 4.8 (len: 10.8) */}
        <mesh
          position={[10, 2.6, -0.6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 5.2, 10.8]} />
        </mesh>
        <mesh
          position={[10, skirtingHeight / 2, -0.6]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 10.8]} />
        </mesh>

        {/* South segment: Z: 7.2 to 21.8 (len: 14.6m, leaving Z: 21.8 to 24.0 open for d-ent-east passage) */}
        <mesh
          position={[10, 2.6, 14.5]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 5.2, 14.6]} />
        </mesh>
        <mesh
          position={[10, skirtingHeight / 2, 14.5]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 14.6]} />
        </mesh>

        {/* Header lintel above d-main-east (Z: 4.8 to 7.2, Y: 3.2 to 5.2) */}
        <mesh
          position={[10, 4.2, 6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 2.0, 2.4]} />
        </mesh>

        {/* Header lintel above East Wing entrance passage (Z: 21.8 to 24.0, Y: 3.2 to 5.2) */}
        <mesh
          position={[10, 4.2, 22.9]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 2.0, 2.2]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 5. SHARED PARTITION: MAIN HALL <-> CORRIDOR (Z = -6)     */}
      {/* Deduplicated: w-main-n and w-corr-s unified. H = 5.2m     */}
      {/* Doorway d-main-corridor at X = 0 (width: 2.6, height: 3.4)*/}
      {/* West Vestibule Passage at X: -12 to -9.9                  */}
      {/* East Vestibule Passage at X: 9.9 to 12                   */}
      {/* ========================================================= */}
      <group name="partition-main-corridor">
        {/* West solid section: X: -9.9 to -1.3 (len: 8.6) */}
        <mesh
          position={[-5.6, 2.6, -6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[8.6, 5.2, wallThickness]} />
        </mesh>
        <mesh
          position={[-5.6, skirtingHeight / 2, -6]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[8.6, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* East solid section: X: 1.3 to 9.9 (len: 8.6) */}
        <mesh
          position={[5.6, 2.6, -6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[8.6, 5.2, wallThickness]} />
        </mesh>
        <mesh
          position={[5.6, skirtingHeight / 2, -6]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[8.6, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* Header lintel above d-main-corridor (X: -1.3 to 1.3, Y: 3.4 to 5.2) */}
        <mesh
          position={[0, 4.3, -6]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.6, 1.8, wallThickness]} />
        </mesh>

        {/* Header lintel above d-west-corridor at Z = -6 (X: -12 to -9.9, Y: 3.0 to 4.8) */}
        <mesh
          position={[-11, 3.9, -6]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.2, 1.8, wallThickness]} />
        </mesh>

        {/* Header lintel above d-east-corridor at Z = -6 (X: 9.9 to 12, Y: 3.0 to 4.8) */}
        <mesh
          position={[11, 3.9, -6]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2.2, 1.8, wallThickness]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 6. ROOM 3: WEST GALLERY PERIMETER WALLS (H = 4.5m)        */}
      {/* ========================================================= */}
      {/* South Wall: w-west-s (X: -26 to -10, Z = 15) */}
      <group name="wall-west-south">
        <mesh
          position={[-18, 2.25, 15]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[16 + wallThickness, 4.5, wallThickness]} />
        </mesh>
        <mesh
          position={[-18, skirtingHeight / 2, 15]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[16, skirtingHeight, skirtingThickness]} />
        </mesh>
      </group>

      {/* West Wall: w-west-w (Z: -3 to 15, X = -26) */}
      <group name="wall-west-west">
        <mesh
          position={[-26, 2.25, 6]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.5, 18]} />
        </mesh>
        <mesh
          position={[-26, skirtingHeight / 2, 6]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 18]} />
        </mesh>
      </group>

      {/* North Wall: w-west-n (X: -26 to -12, Z = -3) */}
      <group name="wall-west-north">
        <mesh
          position={[-19, 2.25, -3]}
          material={materials["charcoal-matte"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[14, 4.5, wallThickness]} />
        </mesh>
        <mesh
          position={[-19, skirtingHeight / 2, -3]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[14, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* West Vestibule Enclosure Return: X = -12, Z: -6 to -3 */}
        <mesh
          position={[-12, 2.4, -4.5]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.8, 3]} />
        </mesh>
        <mesh
          position={[-12, skirtingHeight / 2, -4.5]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 3]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 7. ROOM 4: EAST WING PERIMETER WALLS (H = 4.5m)           */}
      {/* ========================================================= */}
      {/* South Wall: w-east-s (X: 10 to 26, Z = 24) */}
      <group name="wall-east-south">
        <mesh
          position={[18, 2.25, 24]}
          material={materials["muted-teal"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[16 + wallThickness, 4.5, wallThickness]} />
        </mesh>
        <mesh
          position={[18, skirtingHeight / 2, 24]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[16, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* East Portico Corridor Return North Wall: Z = 21.8, X: 8 to 10 */}
        <mesh
          position={[9, 2.25, 21.8]}
          material={materials["muted-teal"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2, 4.5, wallThickness]} />
        </mesh>
        <mesh
          position={[9, skirtingHeight / 2, 21.8]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[2, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* East Portico Corridor Return South Wall: Z = 24.0, X: 8 to 10 */}
        <mesh
          position={[9, 2.25, 24]}
          material={materials["muted-teal"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[2, 4.5, wallThickness]} />
        </mesh>
        <mesh
          position={[9, skirtingHeight / 2, 24]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[2, skirtingHeight, skirtingThickness]} />
        </mesh>
      </group>

      {/* East Wall: w-east-e (Z: -3 to 24, X = 26) */}
      <group name="wall-east-east">
        <mesh
          position={[26, 2.25, 10.5]}
          material={materials["muted-teal"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.5, 27]} />
        </mesh>
        <mesh
          position={[26, skirtingHeight / 2, 10.5]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 27]} />
        </mesh>
      </group>

      {/* North Wall: w-east-n (X: 12 to 26, Z = -3) */}
      <group name="wall-east-north">
        <mesh
          position={[19, 2.25, -3]}
          material={materials["muted-teal"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[14, 4.5, wallThickness]} />
        </mesh>
        <mesh
          position={[19, skirtingHeight / 2, -3]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[14, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* East Vestibule Enclosure Return: X = 12, Z: -6 to -3 */}
        <mesh
          position={[12, 2.4, -4.5]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.8, 3]} />
        </mesh>
        <mesh
          position={[12, skirtingHeight / 2, -4.5]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 3]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 8. ROOM 5: CENTRAL CONNECTING VESTIBULE WALLS (H = 4.8m)  */}
      {/* ========================================================= */}
      {/* West Wall: w-corr-w (Z: -16 to -6, X = -12) */}
      <group name="wall-corr-west">
        <mesh
          position={[-12, 2.4, -11]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.8, 10]} />
        </mesh>
        <mesh
          position={[-12, skirtingHeight / 2, -11]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 10]} />
        </mesh>
      </group>

      {/* East Wall: w-corr-e (Z: -16 to -6, X = 12) */}
      <group name="wall-corr-east">
        <mesh
          position={[12, 2.4, -11]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 4.8, 10]} />
        </mesh>
        <mesh
          position={[12, skirtingHeight / 2, -11]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 10]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 9. SHARED PARTITION: VESTIBULE <-> SANCTUARY (Z = -16)   */}
      {/* Deduplicated: w-corr-n and w-feat-s unified. H = 5.2m     */}
      {/* Doorway d-corr-feat at X = 0 (width: 3.0, height: 3.8)    */}
      {/* Opening spans X: -1.5 to 1.5. Total span X: -12 to 12     */}
      {/* ========================================================= */}
      <group name="partition-corr-featured">
        {/* West outer wing: X: -12 to -9 (len: 3.0) */}
        <mesh
          position={[-10.5, 2.4, -16]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.0, 4.8, wallThickness]} />
        </mesh>
        <mesh
          position={[-10.5, skirtingHeight / 2, -16]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[3.0, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* West inner wall: X: -9 to -1.5 (len: 7.5) */}
        <mesh
          position={[-5.25, 2.6, -16]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[7.5, 5.2, wallThickness]} />
        </mesh>
        <mesh
          position={[-5.25, skirtingHeight / 2, -16]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[7.5, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* East inner wall: X: 1.5 to 9 (len: 7.5) */}
        <mesh
          position={[5.25, 2.6, -16]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[7.5, 5.2, wallThickness]} />
        </mesh>
        <mesh
          position={[5.25, skirtingHeight / 2, -16]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[7.5, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* East outer wing: X: 9 to 12 (len: 3.0) */}
        <mesh
          position={[10.5, 2.4, -16]}
          material={materials["warm-grey"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.0, 4.8, wallThickness]} />
        </mesh>
        <mesh
          position={[10.5, skirtingHeight / 2, -16]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[3.0, skirtingHeight, skirtingThickness]} />
        </mesh>

        {/* Header lintel above d-corr-feat (X: -1.5 to 1.5, Y: 3.8 to 5.2) */}
        <mesh
          position={[0, 4.5, -16]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[3.0, 1.4, wallThickness]} />
        </mesh>
      </group>

      {/* ========================================================= */}
      {/* 10. ROOM 6: FEATURED MASTERPIECE SANCTUARY (H = 5.2m)     */}
      {/* ========================================================= */}
      {/* West Wall: w-feat-w (Z: -36 to -16, X = -9) */}
      <group name="wall-feat-west">
        <mesh
          position={[-9, 2.6, -26]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 5.2, 20]} />
        </mesh>
        <mesh
          position={[-9, skirtingHeight / 2, -26]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 20]} />
        </mesh>
      </group>

      {/* East Wall: w-feat-e (Z: -36 to -16, X = 9) */}
      <group name="wall-feat-east">
        <mesh
          position={[9, 2.6, -26]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[wallThickness, 5.2, 20]} />
        </mesh>
        <mesh
          position={[9, skirtingHeight / 2, -26]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[skirtingThickness, skirtingHeight, 20]} />
        </mesh>
      </group>

      {/* North Apex Wall: w-feat-n (X: -9 to 9, Z = -36) */}
      <group name="wall-feat-north-apex">
        <mesh
          position={[0, 2.6, -36]}
          material={materials["deep-slate"]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[18 + wallThickness, 5.2, wallThickness]} />
        </mesh>
        <mesh
          position={[0, skirtingHeight / 2, -36]}
          material={materials.skirting}
          receiveShadow
        >
          <boxGeometry args={[18, skirtingHeight, skirtingThickness]} />
        </mesh>
      </group>
    </group>
  );
}
