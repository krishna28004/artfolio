
const WALL_MAT_PROPS = {
    color: "#1a1a1a",
    roughness: 1,
    metalness: 0,
};

const FLOOR_MAT_PROPS = {
    color: "#0d0d0d",
    roughness: 0.9,
    metalness: 0.1,
};

interface HallProps {
    // Center position of this hall
    position?: [number, number, number];
    // Dimensions
    width?: number;
    depth?: number;
    height?: number;
    // Which walls have openings (passages to other halls)
    openings?: ("north" | "south" | "east" | "west")[];
}

export function Hall({
    position = [0, 0, 0],
    width = 12,
    depth = 14,
    height = 5,
    openings = [],
}: HallProps) {
    const [cx, cy, cz] = position;
    const hw = width / 2;
    const hd = depth / 2;
    const hh = height / 2;

    // Wall height above floor
    const wallY = cy + hh;

    return (
        <group>
            {/* Floor */}
            <mesh position={[cx, cy, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial {...FLOOR_MAT_PROPS} />
            </mesh>

            {/* Ceiling */}
            <mesh position={[cx, cy + height, cz]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[width, depth]} />
                <meshStandardMaterial color="#0a0a0a" roughness={1} />
            </mesh>

            {/* North Wall (negative Z) */}
            {!openings.includes("north") && (
                <mesh position={[cx, wallY, cz - hd]}>
                    <planeGeometry args={[width, height]} />
                    <meshStandardMaterial {...WALL_MAT_PROPS} />
                </mesh>
            )}

            {/* South Wall (positive Z) */}
            {!openings.includes("south") && (
                <mesh position={[cx, wallY, cz + hd]} rotation={[0, Math.PI, 0]}>
                    <planeGeometry args={[width, height]} />
                    <meshStandardMaterial {...WALL_MAT_PROPS} />
                </mesh>
            )}

            {/* West Wall (negative X) */}
            {!openings.includes("west") && (
                <mesh position={[cx - hw, wallY, cz]} rotation={[0, Math.PI / 2, 0]}>
                    <planeGeometry args={[depth, height]} />
                    <meshStandardMaterial {...WALL_MAT_PROPS} />
                </mesh>
            )}

            {/* East Wall (positive X) */}
            {!openings.includes("east") && (
                <mesh position={[cx + hw, wallY, cz]} rotation={[0, -Math.PI / 2, 0]}>
                    <planeGeometry args={[depth, height]} />
                    <meshStandardMaterial {...WALL_MAT_PROPS} />
                </mesh>
            )}

            {/* Baseboard trim along all walls */}
            <mesh position={[cx, cy + 0.05, cz]}>
                <boxGeometry args={[width, 0.1, depth]} />
                <meshStandardMaterial color="#111" roughness={0.9} />
            </mesh>

            {/* Ceiling coving trim */}
            <mesh position={[cx, cy + height - 0.05, cz]}>
                <boxGeometry args={[width, 0.1, depth]} />
                <meshStandardMaterial color="#111" roughness={0.9} />
            </mesh>
        </group>
    );
}
