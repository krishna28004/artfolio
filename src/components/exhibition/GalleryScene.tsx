"use client";
import React, { Suspense, useCallback } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { Environment, ContactShadows, BakeShadows, PerformanceMonitor, Preload } from "@react-three/drei";
import * as THREE from "three";

import { Room } from "./Room";
import { Lights } from "./Lights";
import { Controls, walkToTarget } from "./Controls";
import { ArtworkFrame } from "./ArtworkFrame";
import { Plant, Bench, PersonSilhouette } from "./Props";

function WebGLCleanup() {
    const { gl } = useThree();
    React.useEffect(() => {
        return () => {
            gl.dispose();
            gl.forceContextLoss();
        };
    }, [gl]);
    return null;
}

export const ARTWORKS = [
    // Left Wall (West) — spaced along Z axis
    { id: "luminous-veil", url: "/images/artworks/luminous-veil.jpg", position: [-24.92, 2.1, -28] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { id: "sovereign-gaze", url: "/images/artworks/sovereign-gaze.jpg", position: [-24.92, 2.1, -12] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { id: "monsoon-child", url: "/images/artworks/monsoon-child.jpg", position: [-24.92, 2.1, 4] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },
    { id: "tears-in-the-rain", url: "/images/artworks/tears-in-the-rain.jpg", position: [-24.92, 2.1, 20] as [number, number, number], rotation: [0, Math.PI / 2, 0] as [number, number, number] },

    // Right Wall (East)
    { id: "the-dreamer", url: "/images/artworks/the-dreamer.jpg", position: [24.92, 2.1, -28] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { id: "behind-the-lens", url: "/images/artworks/behind-the-lens.jpg", position: [24.92, 2.1, -12] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { id: "radiant-spirit", url: "/images/artworks/radiant-spirit.jpg", position: [24.92, 2.1, 4] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },
    { id: "chrome-elegy", url: "/images/artworks/chrome-elegy.jpg", position: [24.92, 2.1, 20] as [number, number, number], rotation: [0, -Math.PI / 2, 0] as [number, number, number] },

    // Back Wall (North)
    { id: "the-curious-mr-bean", url: "/images/artworks/the-curious-mr-bean.jpg", position: [-10, 2.1, -39.92] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
    { id: "sorcerer-supreme", url: "/images/artworks/sorcerer-supreme.jpg", position: [10, 2.1, -39.92] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] },
];

/* The clickable floor plane that handles double-click walk-to and mobile taps */

function WalkableFloor() {
    const tapState = React.useRef({ time: 0, x: 0, y: 0 });

    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
        tapState.current = { time: Date.now(), x: e.clientX, y: e.clientY };
    }, []);

    const handlePointerUp = useCallback((e: ThreeEvent<PointerEvent>) => {
        const { time, x, y } = tapState.current;
        const timeDiff = Date.now() - time;
        const distSq = Math.pow(e.clientX - x, 2) + Math.pow(e.clientY - y, 2);

        // Tap threshold: < 250ms and < 20px movement (400 distSq) to segregate from camera drag
        if (timeDiff < 250 && distSq < 400) {
            e.stopPropagation();
            const point = e.point as THREE.Vector3;
            walkToTarget.x = Math.max(-23, Math.min(23, point.x));
            walkToTarget.z = Math.max(-38, Math.min(38, point.z));
            walkToTarget.active = true;
        }
    }, []);

    return (
        <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.01, 0]}
            onDoubleClick={handlePointerUp} // Same trigger handles desktop fast clicks
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            visible={false}
        >
            <planeGeometry args={[50, 80]} />
            <meshBasicMaterial transparent opacity={0} />
        </mesh>
    );
}

export function GalleryScene() {
    const [dpr, setDpr] = React.useState(1.5);
    return (
        <Canvas
            shadows
            camera={{ position: [0, 1.7, 30], fov: 60 }}
            dpr={dpr}
            gl={{ antialias: true, powerPreference: "high-performance", stencil: false }}
            className="w-full h-full bg-[#080808]"
        >
            <PerformanceMonitor onIncline={() => setDpr(1.5)} onDecline={() => setDpr(0.75)} />
            <WebGLCleanup />
            <Suspense fallback={null}>
                <Environment preset="city" />
                <Lights />
                <Room />
                <Controls />
                <WalkableFloor />
                
                {/* Floor Shadows Optimized */}
                <ContactShadows resolution={512} scale={100} blur={2.5} opacity={0.5} far={10} position={[0, 0.02, 0]} />
                <BakeShadows />

                {/* Artworks */}
                {ARTWORKS.map((art, i) => (
                    <group key={`art-group-${i}`}>
                        <ArtworkFrame {...art} />
                    </group>
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
            <Preload all />
        </Canvas>
    );
}
