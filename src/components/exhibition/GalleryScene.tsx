"use client";
import React, { Suspense, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

import { Room } from "./Room";
import { Lights } from "./Lights";
import { Controls, walkToTarget } from "./Controls";
import { ArtworkFrame } from "./ArtworkFrame";
import { Plant, Bench, PersonSilhouette } from "./Props";
import { HangingOrb, BeamSpotlight } from "./ExhibitionProps";

const ARTWORKS = [
    // Left Wall (West) — spaced along Z axis
    { id: "luminous-veil", url: "/images/artworks/luminous-veil.jpg", position: [-24.85, 3.5, -28] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { id: "sovereign-gaze", url: "/images/artworks/sovereign-gaze.jpg", position: [-24.85, 3.5, -12] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { id: "monsoon-child", url: "/images/artworks/monsoon-child.jpg", position: [-24.85, 3.5, 4] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { id: "tears-in-the-rain", url: "/images/artworks/tears-in-the-rain.jpg", position: [-24.85, 3.5, 20] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },

    // Right Wall (East)
    { id: "the-dreamer", url: "/images/artworks/the-dreamer.jpg", position: [24.85, 3.5, -28] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { id: "behind-the-lens", url: "/images/artworks/behind-the-lens.jpg", position: [24.85, 3.5, -12] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { id: "radiant-spirit", url: "/images/artworks/radiant-spirit.jpg", position: [24.85, 3.5, 4] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { id: "chrome-elegy", url: "/images/artworks/chrome-elegy.jpg", position: [24.85, 3.5, 20] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },

    // Back Wall (North)
    { id: "the-curious-mr-bean", url: "/images/artworks/the-curious-mr-bean.jpg", position: [-10, 3.5, -39.85] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
    { id: "sorcerer-supreme", url: "/images/artworks/sorcerer-supreme.jpg", position: [10, 3.5, -39.85] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
];

/* The clickable floor plane that handles double-click walk-to */
import { ThreeEvent } from "@react-three/fiber";

function WalkableFloor() {
    const handleDoubleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const point = e.point as THREE.Vector3;
        // Clamp to safe boundaries for the expanded room
        walkToTarget.x = Math.max(-23, Math.min(23, point.x));
        walkToTarget.z = Math.max(-38, Math.min(38, point.z));
        walkToTarget.active = true;
    }, []);

    return (
        <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 0]}
            onDoubleClick={handleDoubleClick}
            visible={false}
        >
            <planeGeometry args={[50, 80]} />
            <meshBasicMaterial transparent opacity={0} />
        </mesh>
    );
}

export function GalleryScene() {
    return (
        <Canvas
            shadows
            camera={{ position: [0, 1.7, 30], fov: 60 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
            className="w-full h-full bg-[#080808]"
        >
            <Suspense fallback={null}>
                <Environment preset="night" />
                <Lights />
                <Room />
                <Controls />
                <WalkableFloor />

                {/* Artworks & Targeted Spotlights */}
                {ARTWORKS.map((art, i) => (
                    <group key={`art-group-${i}`}>
                        <ArtworkFrame {...art} />
                        {/* Overhead Spotlight (placed relative to wall) */}
                        <BeamSpotlight
                            position={[
                                art.position[0] * 0.95, // slightly off-wall
                                6.5,
                                art.position[2]
                            ]}
                            target={art.position}
                        />
                    </group>
                ))}

                {/* === CRAFTED LIGHTING PROPS === */}

                {/* Center Row Hanging Orbs */}
                {[-25, -10, 5, 20].map((z, idx) => (
                    <HangingOrb key={`orb-c-${idx}`} position={[0, 4.5, z]} />
                ))}

                {/* Side Aisle Hanging Orbs */}
                {[-15, 15].map((x, i) => (
                    [-20, 10].map((z, j) => (
                        <HangingOrb key={`orb-s-${i}-${j}`} position={[x, 5, z]} />
                    ))
                ))}

                {/* === ENVIRONMENTAL PROPS === */}

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

            </Suspense>
        </Canvas>
    );
}
