"use client";
import React, { useEffect } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface ArtworkFrameProps {
    url: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    id: string;
    scale?: [number, number, number];
}

import { useThree } from "@react-three/fiber";

export function ArtworkFrame({
    url,
    position,
    rotation = [0, 0, 0],
    scale = [1.5, 2, 1],
}: Omit<ArtworkFrameProps, "id">) {
    const { gl } = useThree();
    const texture = useTexture(url);
    // Apply HD texture filtering and memory management safely once
    useEffect(() => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = Math.min(gl.capabilities.getMaxAnisotropy(), 16); // Cap to 16 for stability
        texture.generateMipmaps = true;
        texture.needsUpdate = true;
        
        return () => {
            texture.dispose();
        };
    }, [texture, gl]);

    return (
        <group position={position} rotation={rotation} scale={scale}>

            {/* Light is now beautifully handled by BeamSpotlight over this frame. */}

            {/* Frame Outer Border (Thin Black Wood) */}
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[1.2, 1.2, 0.05]} />
                <meshStandardMaterial color="#111111" roughness={0.9} />
            </mesh>

            {/* Inner White Matting */}
            <mesh position={[0, 0, 0.03]}>
                <planeGeometry args={[1.15, 1.15]} />
                <meshStandardMaterial color="#f0f0f0" roughness={1} />
            </mesh>

            {/* Canvas Artwork — purely visual */}
            <mesh position={[0, 0, 0.035]}>
                <planeGeometry args={[0.9, 0.9]} />
                <meshStandardMaterial
                    map={texture}
                    roughness={0.3}
                    metalness={0.15}
                />
            </mesh>
        </group>
    );
}
