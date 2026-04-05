/*
  Gallery Props — Environmental details to make the hall feel realistic.
  All built from primitive geometry (no GLTF models needed).
*/

/* ========== POTTED PLANT ========== */
export function Plant({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            {/* Pot */}
            <mesh position={[0, 0.4, 0]}>
                <cylinderGeometry args={[0.25, 0.2, 0.8, 8]} />
                <meshStandardMaterial color="#3a2a1a" roughness={0.9} />
            </mesh>
            {/* Soil */}
            <mesh position={[0, 0.81, 0]}>
                <cylinderGeometry args={[0.22, 0.22, 0.05, 8]} />
                <meshStandardMaterial color="#2a1f10" roughness={1} />
            </mesh>
            {/* Leaves cluster (3 overlapping spheres for a bushy look) */}
            <mesh position={[0, 1.3, 0]}>
                <sphereGeometry args={[0.35, 8, 6]} />
                <meshStandardMaterial color="#2d4a2d" roughness={0.9} />
            </mesh>
            <mesh position={[0.15, 1.5, 0.1]}>
                <sphereGeometry args={[0.25, 8, 6]} />
                <meshStandardMaterial color="#3a5c3a" roughness={0.9} />
            </mesh>
            <mesh position={[-0.1, 1.45, -0.08]}>
                <sphereGeometry args={[0.28, 8, 6]} />
                <meshStandardMaterial color="#2e5030" roughness={0.9} />
            </mesh>
        </group>
    );
}

/* ========== BENCH ========== */
export function Bench({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation}>
            {/* Seat slab */}
            <mesh position={[0, 0.45, 0]}>
                <boxGeometry args={[1.6, 0.08, 0.5]} />
                <meshStandardMaterial color="#4a3520" roughness={0.8} />
            </mesh>
            {/* Left leg */}
            <mesh position={[-0.65, 0.22, 0]}>
                <boxGeometry args={[0.08, 0.45, 0.4]} />
                <meshStandardMaterial color="#222" roughness={0.9} />
            </mesh>
            {/* Right leg */}
            <mesh position={[0.65, 0.22, 0]}>
                <boxGeometry args={[0.08, 0.45, 0.4]} />
                <meshStandardMaterial color="#222" roughness={0.9} />
            </mesh>
        </group>
    );
}

/* ========== PERSON SILHOUETTE ========== */
export function PersonSilhouette({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation}>
            {/* Head */}
            <mesh position={[0, 1.65, 0]}>
                <sphereGeometry args={[0.12, 8, 6]} />
                <meshStandardMaterial color="#1a1a1a" roughness={1} />
            </mesh>
            {/* Body (torso) */}
            <mesh position={[0, 1.2, 0]}>
                <capsuleGeometry args={[0.15, 0.5, 4, 8]} />
                <meshStandardMaterial color="#1c1c1c" roughness={1} />
            </mesh>
            {/* Legs */}
            <mesh position={[-0.08, 0.55, 0]}>
                <capsuleGeometry args={[0.06, 0.6, 4, 8]} />
                <meshStandardMaterial color="#141414" roughness={1} />
            </mesh>
            <mesh position={[0.08, 0.55, 0]}>
                <capsuleGeometry args={[0.06, 0.6, 4, 8]} />
                <meshStandardMaterial color="#141414" roughness={1} />
            </mesh>
        </group>
    );
}
