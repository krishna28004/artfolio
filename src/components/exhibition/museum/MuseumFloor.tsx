"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Room, Doorway, FloorType } from "../config/museum.config";

interface MuseumFloorProps {
  rooms: Room[];
  doorways?: Doorway[];
}

/**
 * Procedural PBR Canvas Texture Generators for Museum Architectural Flooring.
 * Guarantees zero network load, perfect seamless repeat tiling, and rich luxury aesthetics.
 */
function createHerringboneCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Base warm walnut tone
  ctx.fillStyle = "#8c6b4a";
  ctx.fillRect(0, 0, 512, 512);

  // Draw herringbone interlocking slats
  const slatW = 32;
  const slatH = 128;
  const baseTones = ["#9c7753", "#8f6946", "#825d3b", "#a6825c", "#785333"];

  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "#382312";

  for (let y = -slatH; y < 512 + slatH; y += slatW * 2) {
    for (let x = -slatH; x < 512 + slatH; x += slatH) {
      // Slat 1: 45 degree angle
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = baseTones[Math.abs(Math.floor(x + y)) % baseTones.length];
      ctx.fillRect(0, 0, slatH, slatW);
      ctx.strokeRect(0, 0, slatH, slatW);

      // Fine wood grain lines
      ctx.fillStyle = "rgba(45, 25, 10, 0.08)";
      for (let g = 4; g < slatW; g += 6) {
        ctx.fillRect(0, g, slatH, 1);
      }
      ctx.restore();

      // Slat 2: -45 degree angle
      ctx.save();
      ctx.translate(x + slatW, y);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = baseTones[Math.abs(Math.floor(x * 2 + y)) % baseTones.length];
      ctx.fillRect(0, 0, slatH, slatW);
      ctx.strokeRect(0, 0, slatH, slatW);

      // Fine wood grain lines
      ctx.fillStyle = "rgba(45, 25, 10, 0.08)";
      for (let g = 4; g < slatW; g += 6) {
        ctx.fillRect(0, g, slatH, 1);
      }
      ctx.restore();
    }
  }

  return canvas;
}

function createPlankCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#524132";
  ctx.fillRect(0, 0, 512, 512);

  const plankW = 64;
  const tones = ["#5a4838", "#4e3d2f", "#63503f", "#473729"];

  for (let x = 0; x < 512; x += plankW) {
    ctx.fillStyle = tones[(x / plankW) % tones.length];
    ctx.fillRect(x, 0, plankW, 512);

    // Plank seam
    ctx.fillStyle = "#261c14";
    ctx.fillRect(x, 0, 2, 512);

    // Subtle grain streaks
    ctx.fillStyle = "rgba(30, 20, 10, 0.06)";
    for (let g = 6; g < plankW; g += 10) {
      ctx.fillRect(x + g, 0, 2, 512);
    }
  }

  return canvas;
}

function createLimestoneCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#3d3b37";
  ctx.fillRect(0, 0, 512, 512);

  const tile = 128;
  const tones = ["#3f3d39", "#393734", "#44423e", "#353330"];

  for (let y = 0; y < 512; y += tile) {
    for (let x = 0; x < 512; x += tile) {
      ctx.fillStyle = tones[((x + y) / tile) % tones.length];
      ctx.fillRect(x + 2, y + 2, tile - 4, tile - 4);

      // Grout line
      ctx.strokeStyle = "#232220";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, tile, tile);
    }
  }

  return canvas;
}

export function MuseumFloor({ rooms, doorways = [] }: MuseumFloorProps) {
  // Generate high-resolution procedural textures once on client
  const { herringboneTex, plankTex, limestoneTex } = useMemo(() => {
    if (typeof document === "undefined") {
      return { herringboneTex: null, plankTex: null, limestoneTex: null };
    }

    const hbTex = new THREE.CanvasTexture(createHerringboneCanvas());
    hbTex.wrapS = hbTex.wrapT = THREE.RepeatWrapping;
    hbTex.repeat.set(6, 8);
    hbTex.colorSpace = THREE.SRGBColorSpace;

    const plTex = new THREE.CanvasTexture(createPlankCanvas());
    plTex.wrapS = plTex.wrapT = THREE.RepeatWrapping;
    plTex.repeat.set(4, 6);
    plTex.colorSpace = THREE.SRGBColorSpace;

    const lsTex = new THREE.CanvasTexture(createLimestoneCanvas());
    lsTex.wrapS = lsTex.wrapT = THREE.RepeatWrapping;
    lsTex.repeat.set(4, 4);
    lsTex.colorSpace = THREE.SRGBColorSpace;

    return { herringboneTex: hbTex, plankTex: plTex, limestoneTex: lsTex };
  }, []);

  // Reusable PBR Floor Materials
  const materials = useMemo(() => {
    return {
      "walnut-herringbone": new THREE.MeshStandardMaterial({
        map: herringboneTex || undefined,
        color: "#b08c68",
        roughness: 0.28,
        metalness: 0.08,
      }),
      "dark-oak-plank": new THREE.MeshStandardMaterial({
        map: plankTex || undefined,
        color: "#7a6350",
        roughness: 0.35,
        metalness: 0.05,
      }),
      "limestone-tile": new THREE.MeshStandardMaterial({
        map: limestoneTex || undefined,
        color: "#4e4a44",
        roughness: 0.52,
        metalness: 0.04,
      }),
      "polished-marble": new THREE.MeshStandardMaterial({
        color: "#1a1c1e",
        roughness: 0.16,
        metalness: 0.15,
      }),
      threshold: new THREE.MeshStandardMaterial({
        color: "#28221b",
        roughness: 0.45,
        metalness: 0.35,
      }),
    };
  }, [herringboneTex, plankTex, limestoneTex]);

  return (
    <group name="museum-floors">
      {/* 1. Main Room Floors */}
      {rooms.map((room) => {
        const width = room.bounds.maxX - room.bounds.minX;
        const depth = room.bounds.maxZ - room.bounds.minZ;
        const centerX = (room.bounds.minX + room.bounds.maxX) / 2;
        const centerZ = (room.bounds.minZ + room.bounds.maxZ) / 2;

        const material =
          materials[room.floorType as FloorType] ||
          materials["walnut-herringbone"];

        return (
          <mesh
            key={`floor-${room.id}`}
            position={[centerX, 0.001, centerZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            material={material}
            receiveShadow
          >
            <planeGeometry args={[width, depth]} />
          </mesh>
        );
      })}

      {/* 2. Seamless Connector Passage Floors */}
      {/* West Vestibule Connector: X: [-12, -10], Z: [-6, -3] (w: 2, d: 3) */}
      <mesh
        position={[-11, 0.001, -4.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials["limestone-tile"]}
        receiveShadow
      >
        <planeGeometry args={[2, 3]} />
      </mesh>

      {/* East Vestibule Connector: X: [10, 12], Z: [-6, -3] (w: 2, d: 3) */}
      <mesh
        position={[11, 0.001, -4.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials["limestone-tile"]}
        receiveShadow
      >
        <planeGeometry args={[2, 3]} />
      </mesh>

      {/* Entrance to East Promenade Connector: X: [8, 10], Z: [22.8, 25.2] (w: 2, d: 2.4) */}
      <mesh
        position={[9, 0.001, 24]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={materials["walnut-herringbone"]}
        receiveShadow
      >
        <planeGeometry args={[2, 2.4]} />
      </mesh>

      {/* 3. Threshold Transition Strips below doorways */}
      {doorways.map((door) => {
        const [dx, , dz] = door.position;
        const isEW = Math.abs(door.normal[0]) > 0.5;
        const stripWidth = isEW ? 0.32 : door.width + 0.1;
        const stripDepth = isEW ? door.width + 0.1 : 0.32;

        return (
          <mesh
            key={`threshold-${door.id}`}
            position={[dx, 0.003, dz]}
            material={materials.threshold}
            receiveShadow
          >
            <boxGeometry args={[stripWidth, 0.006, stripDepth]} />
          </mesh>
        );
      })}
    </group>
  );
}
