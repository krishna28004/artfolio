"use client";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface ArtworkFrameProps {
    url: string;
    position: [number, number, number];
    rotation?: [number, number, number];
    id: string;
    scale?: [number, number, number];
}

export function ArtworkFrame({
    url,
    position,
    rotation = [0, 0, 0],
    scale = [1.5, 2, 1],
}: Omit<ArtworkFrameProps, "id">) {
    const texture = useTexture(url);
    // eslint-disable-next-line react-hooks/immutability
    texture.colorSpace = THREE.SRGBColorSpace;
    // eslint-disable-next-line react-hooks/immutability
    texture.minFilter = THREE.LinearMipmapLinearFilter;

    return (
        <group position={position} rotation={rotation} scale={scale}>

            {/* Warm Gallery Track Spotlight */}
            <spotLight
                position={[0, 2.5, 2]}
                target-position={[0, 0, 0]}
                angle={0.6}
                penumbra={0.7}
                intensity={3}
                color="#ffebd6"
                distance={8}
                castShadow={false}
            />

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

            {/* Canvas Artwork — purely visual, NO click navigation */}
            <mesh position={[0, 0, 0.035]}>
                <planeGeometry args={[0.9, 0.9]} />
                <meshStandardMaterial
                    map={texture}
                    roughness={0.6}
                    metalness={0.1}
                />
            </mesh>
        </group>
    );
}
