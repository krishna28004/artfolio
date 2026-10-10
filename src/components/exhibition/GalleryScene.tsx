"use client";

import React, { Suspense, useCallback, useMemo } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import {
  Environment,
  ContactShadows,
  BakeShadows,
  PerformanceMonitor,
  Preload,
} from "@react-three/drei";
import * as THREE from "three";

import { Room } from "./Room";
import { Lights } from "./Lights";
import { Controls, walkToTarget } from "./Controls";
import { ArtworkFrame } from "./ArtworkFrame";
import { Plant, Bench, PersonSilhouette } from "./Props";
import { MuseumShell } from "./museum/MuseumShell";
import { clampToWalkableBounds, VISITOR_BOUNDS } from "@/features/artwork/utils/exhibition-validation";

function WebGLCleanup() {
  const { gl } = useThree();
  React.useEffect(() => {
    return () => {
      // Clean up renderer allocations without forcefully killing the WebGL context
      gl.dispose();
    };
  }, [gl]);
  return null;
}

export interface GalleryArtwork {
  id: string;
  title?: string;
  artist?: string;
  year?: number;
  medium?: string;
  dimensions?: string;
  url: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Legacy single-room hall artwork coordinates (50m x 80m space).
 * Preserved for full recovery via useLegacyHall feature flag.
 */
export const ARTWORKS: GalleryArtwork[] = [
  // Left Wall (West) — spaced along Z axis
  {
    id: "luminous-veil",
    title: "Luminous Veil",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/luminous-veil.jpg",
    position: [-24.92, 2.1, -28],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "sovereign-gaze",
    title: "Sovereign Gaze",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sovereign-gaze.jpg",
    position: [-24.92, 2.1, -12],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "monsoon-child",
    title: "Monsoon Child",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/monsoon-child.jpg",
    position: [-24.92, 2.1, 4],
    rotation: [0, Math.PI / 2, 0],
  },
  {
    id: "tears-in-the-rain",
    title: "Tears in the Rain",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/tears-in-the-rain.jpg",
    position: [-24.92, 2.1, 20],
    rotation: [0, Math.PI / 2, 0],
  },

  // Right Wall (East)
  {
    id: "the-dreamer",
    title: "The Dreamer",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-dreamer.jpg",
    position: [24.92, 2.1, -28],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "behind-the-lens",
    title: "Behind the Lens",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/behind-the-lens.jpg",
    position: [24.92, 2.1, -12],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "radiant-spirit",
    title: "Radiant Spirit",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/radiant-spirit.jpg",
    position: [24.92, 2.1, 4],
    rotation: [0, -Math.PI / 2, 0],
  },
  {
    id: "chrome-elegy",
    title: "Chrome Elegy",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/chrome-elegy.jpg",
    position: [24.92, 2.1, 20],
    rotation: [0, -Math.PI / 2, 0],
  },

  // Back Wall (North)
  {
    id: "the-curious-mr-bean",
    title: "The Curious Mr. Bean",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-curious-mr-bean.jpg",
    position: [-10, 2.1, -39.92],
    rotation: [0, 0, 0],
  },
  {
    id: "sorcerer-supreme",
    title: "Sorcerer Supreme",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sorcerer-supreme.jpg",
    position: [10, 2.1, -39.92],
    rotation: [0, 0, 0],
  },
];

/**
 * Multi-Room Museum Shell Artwork Coordinates.
 * Maps the 10 artworks to their designated slots across the 6 galleries in museum.config.ts.
 */
export const MUSEUM_ARTWORKS: GalleryArtwork[] = [
  // 1. Featured Sanctuary Apex Slot (Room 6 — Crown Jewel Showcase)
  {
    id: "sorcerer-supreme",
    title: "Sorcerer Supreme",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sorcerer-supreme.jpg",
    position: [0, 1.8, -35.85],
    rotation: [0, 0, 0],
  },
  // 2. Grand Entrance Gallery (Room 1 — Orientation & Welcome)
  {
    id: "the-curious-mr-bean",
    title: "The Curious Mr. Bean",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-curious-mr-bean.jpg",
    position: [-7.85, 1.6, 24],
    rotation: [0, Math.PI / 2, 0],
  },
  // 3. Main Exhibition Hall (Room 2 — West Wall Slot 1)
  {
    id: "luminous-veil",
    title: "Luminous Veil",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/luminous-veil.jpg",
    position: [-9.85, 1.6, 12],
    rotation: [0, Math.PI / 2, 0],
  },
  // 4. Main Exhibition Hall (Room 2 — West Wall Slot 2)
  {
    id: "sovereign-gaze",
    title: "Sovereign Gaze",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/sovereign-gaze.jpg",
    position: [-9.85, 1.6, 0],
    rotation: [0, Math.PI / 2, 0],
  },
  // 5. Main Exhibition Hall (Room 2 — East Wall Slot 1)
  {
    id: "the-dreamer",
    title: "The Dreamer",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/the-dreamer.jpg",
    position: [9.85, 1.6, 12],
    rotation: [0, -Math.PI / 2, 0],
  },
  // 6. Main Exhibition Hall (Room 2 — East Wall Slot 2)
  {
    id: "behind-the-lens",
    title: "Behind the Lens",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/behind-the-lens.jpg",
    position: [9.85, 1.6, 0],
    rotation: [0, -Math.PI / 2, 0],
  },
  // 7. West Gallery (Room 3 — Graphite Realism Salon Slot 1)
  {
    id: "monsoon-child",
    title: "Monsoon Child",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/monsoon-child.jpg",
    position: [-25.85, 1.6, 3],
    rotation: [0, Math.PI / 2, 0],
  },
  // 8. West Gallery (Room 3 — Graphite Realism Salon Slot 2)
  {
    id: "tears-in-the-rain",
    title: "Tears in the Rain",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/tears-in-the-rain.jpg",
    position: [-25.85, 1.6, 9],
    rotation: [0, Math.PI / 2, 0],
  },
  // 9. East Wing (Room 4 — Master Portraiture Salon Slot 1)
  {
    id: "radiant-spirit",
    title: "Radiant Spirit",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/radiant-spirit.jpg",
    position: [25.85, 1.6, 3],
    rotation: [0, -Math.PI / 2, 0],
  },
  // 10. East Wing (Room 4 — Master Portraiture Salon Slot 2)
  {
    id: "chrome-elegy",
    title: "Chrome Elegy",
    artist: "Krishna Kumar",
    year: 2024,
    medium: "Pencil on Paper",
    dimensions: "A3 Sheet",
    url: "/images/artworks/exhibition/chrome-elegy.jpg",
    position: [25.85, 1.6, 11],
    rotation: [0, -Math.PI / 2, 0],
  },
];

/* The clickable floor plane that handles double-click walk-to and mobile taps */
function WalkableFloor() {
  const tapState = React.useRef({ time: 0, x: 0, y: 0 });

  const triggerWalkTo = useCallback((point: THREE.Vector3) => {
    const clamped = clampToWalkableBounds(point.x, point.z);
    walkToTarget.x = clamped.x;
    walkToTarget.z = clamped.z;
    walkToTarget.active = true;
  }, []);

  const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    tapState.current = { time: Date.now(), x: e.clientX, y: e.clientY };
  }, []);

  const handlePointerUp = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      const { time, x, y } = tapState.current;
      const timeDiff = Date.now() - time;
      const distSq = Math.pow(e.clientX - x, 2) + Math.pow(e.clientY - y, 2);

      // On mobile / touch screens, a quick tap (< 300ms, < 20px drag) initiates walking
      if (e.pointerType === "touch" && timeDiff < 300 && distSq < 400) {
        e.stopPropagation();
        triggerWalkTo(e.point as THREE.Vector3);
      }
    },
    [triggerWalkTo]
  );

  const handleDoubleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      // On desktop, double-click reliably initiates walking without single-click conflicts
      e.stopPropagation();
      triggerWalkTo(e.point as THREE.Vector3);
    },
    [triggerWalkTo]
  );

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.01, 0]}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      visible={false}
    >
      <planeGeometry args={[60, 80]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  );
}

export interface GallerySceneProps {
  artworks?: GalleryArtwork[];
  onFocusArtwork?: (art: GalleryArtwork | null) => void;
  useLegacyHall?: boolean;
  prefersReducedMotion?: boolean;
  onPointerLockChange?: (locked: boolean) => void;
}

export function GalleryScene({
  artworks,
  onFocusArtwork,
  useLegacyHall = false,
  prefersReducedMotion = false,
  onPointerLockChange,
}: GallerySceneProps = {}) {
  const [dpr, setDpr] = React.useState(1.5);

  // Map incoming artworks to appropriate gallery slot positions
  const displayArtworks = useMemo(() => {
    if (useLegacyHall) {
      return artworks && artworks.length > 0 ? artworks : ARTWORKS;
    }

    // In Museum Shell mode, assign artworks to configured museum slots
    const baseList = artworks && artworks.length > 0 ? artworks : MUSEUM_ARTWORKS;
    const museumPosMap = new Map<string, GalleryArtwork>(
      MUSEUM_ARTWORKS.map((m) => [m.id, m])
    );

    return baseList.map((art) => {
      const slotMatch = museumPosMap.get(art.id);
      if (slotMatch) {
        return {
          ...art,
          position: slotMatch.position,
          rotation: slotMatch.rotation,
        };
      }
      return art;
    });
  }, [artworks, useLegacyHall]);

  const initialSpawn: [number, number, number] = useLegacyHall
    ? [0, 1.6, 18]
    : [0, 1.65, 27];

  const movementBoundary = useLegacyHall
    ? VISITOR_BOUNDS
    : { minX: -25.5, maxX: 25.5, minZ: -35.5, maxZ: 29.5 };

  return (
    <Canvas
      shadows
      camera={{ position: initialSpawn, fov: 60 }}
      dpr={dpr}
      gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
      className="w-full h-full bg-[#080808]"
    >
      <PerformanceMonitor
        onIncline={() => setDpr(1.5)}
        onDecline={() => setDpr(0.75)}
      />
      <WebGLCleanup />
      <Suspense fallback={null}>
        <Environment preset="city" />

        {/* 1. ARCHITECTURAL SHELL */}
        {useLegacyHall ? (
          <>
            <Lights />
            <Room />
          </>
        ) : (
          <MuseumShell />
        )}

        {/* 2. CONTROLS & CAMERA */}
        <Controls
          artworks={displayArtworks}
          onFocusArtwork={onFocusArtwork}
          initialPosition={initialSpawn}
          boundary={movementBoundary}
          useLegacyHall={useLegacyHall}
          prefersReducedMotion={prefersReducedMotion}
          onPointerLockChange={onPointerLockChange}
        />
        <WalkableFloor />

        {/* 3. OPTIMIZED FLOOR SHADOWS */}
        <ContactShadows
          resolution={512}
          scale={100}
          blur={2.5}
          opacity={0.5}
          far={10}
          position={[0, 0.02, 0]}
        />
        <BakeShadows />

        {/* 4. GALLERY ARTWORKS (Placed in configured slots) */}
        {displayArtworks.map((art, i) => (
          <group key={`art-group-${art.id || i}`}>
            <ArtworkFrame {...art} />
          </group>
        ))}

        {/* 5. ENVIRONMENTAL ACCENTS & BENCHES */}
        {useLegacyHall ? (
          <>
            <Plant position={[-22, 0, -35]} />
            <Plant position={[22, 0, -35]} />
            <Plant position={[-22, 0, 35]} />
            <Plant position={[22, 0, 35]} />
            <Plant position={[0, 0, -38]} />

            <Bench position={[0, 0, -15]} rotation={[0, 0, 0]} />
            <Bench position={[0, 0, 10]} rotation={[0, Math.PI, 0]} />

            <PersonSilhouette position={[-18, 0, -25]} rotation={[0, Math.PI / 2, 0]} />
            <PersonSilhouette position={[18, 0, 10]} rotation={[0, -Math.PI / 2, 0]} />
            <PersonSilhouette position={[-5, 0, -35]} rotation={[0, 0, 0]} />
          </>
        ) : (
          <>
            {/* Gallery Seating at Points of Interest */}
            <Bench position={[0, 0, 6]} rotation={[0, 0, 0]} />
            <Bench position={[-18, 0, 6]} rotation={[0, 0, 0]} />
            <Bench position={[18, 0, 6]} rotation={[0, 0, 0]} />
            <Bench position={[0, 0, -26]} rotation={[0, 0, 0]} />

            {/* Architectural Planters at Portals */}
            <Plant position={[-6, 0, 28]} />
            <Plant position={[6, 0, 28]} />
            <Plant position={[-8.5, 0, 16.5]} />
            <Plant position={[8.5, 0, 16.5]} />
            <Plant position={[-10.5, 0, -14.5]} />
            <Plant position={[10.5, 0, -14.5]} />

            {/* Subtle Visitor Silhouettes in Secondary Wings */}
            <PersonSilhouette position={[-16, 0, 12]} rotation={[0, -Math.PI / 4, 0]} />
            <PersonSilhouette position={[22, 0, 18]} rotation={[0, -Math.PI / 2, 0]} />
            <PersonSilhouette position={[6, 0, -32]} rotation={[0, -Math.PI / 6, 0]} />
          </>
        )}
      </Suspense>
      <Preload all />
    </Canvas>
  );
}
