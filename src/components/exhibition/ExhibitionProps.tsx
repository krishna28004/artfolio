import { useMemo, useRef, useLayoutEffect } from "react";
import * as THREE from "three";

export function HangingOrb({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* The Hanging Cable */}
            <mesh position={[0, 2, 0]}>
                <cylinderGeometry args={[0.01, 0.01, 4]} />
                <meshStandardMaterial color="#111" />
            </mesh>

            {/* The Orb Body (Slatted/Ribbed look using a sphere with wireframe or specific geometry) */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.3, 32, 16]} />
                <meshStandardMaterial
                    color="#f2ca50"
                    emissive="#d4af37"
                    emissiveIntensity={2}
                    wireframe={true}
                />
            </mesh>

            {/* Core Glow */}
            <mesh position={[0, 0, 0]}>
                <sphereGeometry args={[0.15, 16, 16]} />
                <meshStandardMaterial color="#fff" emissive="#fff" emissiveIntensity={5} />
            </mesh>

            {/* Actual Light Source */}
            <pointLight
                intensity={2}
                distance={15}
                color="#ffcc80"
                decay={2}
                castShadow={false}
            />
        </group>
    );
}

export function BeamSpotlight({ position, target }: { position: [number, number, number], target: [number, number, number] }) {
    const lightRef = useRef<THREE.SpotLight>(null);
    const targetRef = useRef<THREE.Object3D>(null);

    useLayoutEffect(() => {
        if (lightRef.current && targetRef.current) {
            lightRef.current.target = targetRef.current;
        }
    }, []);

    return (
        <group position={position}>
            {/* Light Housing */}
            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 0.3]} />
                <meshStandardMaterial color="#1a1a1a" />
            </mesh>

            {/* Spotlight for the artwork below */}
            <spotLight
                ref={lightRef}
                position={[0, 0, 0]}
                angle={0.6}
                penumbra={0.8}
                intensity={200}
                distance={25}
                color="#fff9f0"
                castShadow={false}
            />
            <object3D 
                ref={targetRef} 
                position={[target[0] - position[0], target[1] - position[1], target[2] - position[2]]} 
            />
        </group>
    );
}

export function LightShaft({ position }: { position: [number, number, number] }) {
    return (
        <mesh position={position} rotation={[-Math.PI / 4, 0, 0]}>
            <coneGeometry args={[2, 10, 32]} />
            <meshBasicMaterial color="#ffcc80" transparent opacity={0.05} />
        </mesh>
    );
}
