import { useMemo } from "react";
import { useTexture, Instances, Instance } from "@react-three/drei";
import * as THREE from "three";

export function Room() {
    // Stable dark wood texture from Unsplash (Walnut/Dark Wood)
    // Compressed via w=1024 to prevent memory saturation natively
    const floorTexture = useTexture("https://images.unsplash.com/photo-1520699049698-acd2fccb8cc8?q=80&w=1024&auto=format&fit=crop");
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 8);

    // Deep Fix: Memoize primitives so they aren't instantiated hundreds of times per render
    const wallMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#e8e6e1", roughness: 0.8, metalness: 0.05 }), []);
    const woodMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#b8865c", roughness: 0.6, metalness: 0.1 }), []);
    const darkWoodMaterial = useMemo(() => new THREE.MeshStandardMaterial({
        map: floorTexture,
        color: "#ffffff",
        roughness: 0.3,
        metalness: 0.2
    }), [floorTexture]);
    const blackTrimMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#333333", roughness: 0.8 }), []);
    const ceilingMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d4d4d4", roughness: 1 }), []);
    const blackBackingMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#050505" }), []);
    const shadowMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: "#000", transparent: true, opacity: 0.4 }), []);

    const slatGeo = useMemo(() => new THREE.BoxGeometry(0.08, 7, 0.1), []);
    const beamTransGeo = useMemo(() => new THREE.BoxGeometry(50, 0.5, 0.4), []);
    const shadowBeamTransGeo = useMemo(() => new THREE.BoxGeometry(50.2, 0.1, 0.45), []);
    const beamLongGeo = useMemo(() => new THREE.BoxGeometry(0.4, 0.3, 80), []);

    return (
        <group>
            {/* Floor - High-End Dark Wood Planks */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} material={darkWoodMaterial} receiveShadow>
                <planeGeometry args={[50, 80]} />
            </mesh>

            {/* Ceiling - Dark Industrial Concrete Panel */}
            <mesh position={[0, 7, 0]} rotation={[Math.PI / 2, 0, 0]} material={ceilingMaterial}>
                <planeGeometry args={[50, 80]} />
            </mesh>

            {/* Transverse Beams Instanced */}
            <Instances limit={18} geometry={beamTransGeo} material={woodMaterial} frustumCulled={false}>
                {Array.from({ length: 18 }).map((_, i) => (
                    <Instance key={`beam-${i}`} position={[0, 6.8, -35 + i * 4.5]} />
                ))}
            </Instances>
            
            {/* Transverse Beam Shadows Instanced */}
            <Instances limit={18} geometry={shadowBeamTransGeo} material={shadowMaterial} frustumCulled={false}>
                {Array.from({ length: 18 }).map((_, i) => (
                    <Instance key={`shadow-beam-${i}`} position={[0, 6.6, -35 + i * 4.5]} />
                ))}
            </Instances>

            {/* Longitudinal support beams Instanced */}
            <Instances limit={5} geometry={beamLongGeo} material={woodMaterial} frustumCulled={false}>
                 {[-12, -6, 0, 6, 12].map((x, i) => (
                    <Instance key={`beam-long-${i}`} position={[x, 6.9, 0]} />
                ))}
            </Instances>

            {/* Primary Walls - Textured Concrete */}
            <mesh position={[0, 3.5, -40]} material={wallMaterial}><planeGeometry args={[50, 7]} /></mesh>
            <mesh position={[0, 3.5, 40]} rotation={[0, Math.PI, 0]} material={wallMaterial}><planeGeometry args={[50, 7]} /></mesh>
            <mesh position={[-25, 3.5, 0]} rotation={[0, Math.PI / 2, 0]} material={wallMaterial}><planeGeometry args={[80, 7]} /></mesh>
            <mesh position={[25, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]} material={wallMaterial}><planeGeometry args={[80, 7]} /></mesh>

            {/* Slat Pattern Accents integrated into Walls (Luxury Boutique Look) */}
            <Instances limit={200} geometry={slatGeo} material={woodMaterial} frustumCulled={false}>
                {/* Left Wall Slats */}
                {[-20, 0, 20].map((zPos, idx) => (
                    <group key={`w-slat-l-${idx}`} position={[-24.8, 3.5, zPos]} rotation={[0, Math.PI / 2, 0]}>
                        <mesh position={[0, 0, -0.05]} material={blackBackingMaterial}><boxGeometry args={[6, 7, 0.1]} /></mesh>
                        {Array.from({ length: 25 }).map((_, j) => (
                            <Instance key={`slat-lj-${j}`} position={[-3 + j * 0.25, 0, 0.05]} />
                        ))}
                    </group>
                ))}

                {/* Right Wall Slats */}
                {[-15, 15].map((zPos, idx) => (
                    <group key={`w-slat-r-${idx}`} position={[24.8, 3.5, zPos]} rotation={[0, -Math.PI / 2, 0]}>
                        <mesh position={[0, 0, -0.05]} material={blackBackingMaterial}><boxGeometry args={[8, 7, 0.1]} /></mesh>
                        {Array.from({ length: 32 }).map((_, j) => (
                            <Instance key={`slat-rj-${j}`} position={[-4 + j * 0.25, 0, 0.05]} />
                        ))}
                    </group>
                ))}
            </Instances>

            {/* Heavy Baseboards */}
            <mesh position={[0, 0.15, 0]} material={blackTrimMaterial}>
                <boxGeometry args={[50.2, 0.3, 80.2]} />
            </mesh>
        </group>
    );
}
