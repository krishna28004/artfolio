import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export function Room() {
    // Stable dark wood texture from Unsplash (Walnut/Dark Wood)
    const floorTexture = useTexture("https://images.unsplash.com/photo-1520699049698-acd2fccb8cc8?q=80&w=1500&auto=format&fit=crop");
    floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(4, 8);

    const wallMaterial = <meshStandardMaterial color="#222222" roughness={0.95} metalness={0.05} />;
    const woodMaterial = <meshStandardMaterial color="#8b5a2b" roughness={0.6} metalness={0.1} />;
    const darkWoodMaterial = (
        <meshStandardMaterial
            map={floorTexture}
            color="#443322"
            roughness={0.4}
            metalness={0.2}
        />
    );
    const blackTrimMaterial = <meshStandardMaterial color="#080808" roughness={0.9} />;

    // Create an array for the vertical wooden slats
    const slatCount = 45;
    const slatWidth = 0.08;
    const slatSpacing = 0.18;
    const slatsWidthTotal = slatCount * slatSpacing;

    return (
        <group>
            {/* Floor - High-End Dark Wood Planks */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[50, 80]} />
                {darkWoodMaterial}
            </mesh>

            {/* Ceiling - Dark Industrial Concrete Panel */}
            <mesh position={[0, 7, 0]} rotation={[Math.PI / 2, 0, 0]}>
                <planeGeometry args={[50, 80]} />
                <meshStandardMaterial color="#0c0c0c" roughness={1} />
            </mesh>

            {/* Ceiling Beams - Rustic Structural Wood */}
            {Array.from({ length: 18 }).map((_, i) => (
                <group key={`beam-group-${i}`} position={[0, 6.8, -35 + i * 4.5]}>
                    <mesh>
                        <boxGeometry args={[50, 0.5, 0.4]} />
                        {woodMaterial}
                    </mesh>
                    {/* Shadow Cast Beam */}
                    <mesh position={[0, -0.2, 0]}>
                        <boxGeometry args={[50.2, 0.1, 0.45]} />
                        <meshStandardMaterial color="#000" transparent opacity={0.4} />
                    </mesh>
                </group>
            ))}

            {/* Longitudinal support beams */}
            {[-12, -6, 0, 6, 12].map((x, i) => (
                <mesh key={`beam-long-${i}`} position={[x, 6.9, 0]}>
                    <boxGeometry args={[0.4, 0.3, 80]} />
                    {woodMaterial}
                </mesh>
            ))}

            {/* Primary Walls - Textured Concrete */}
            {/* North Wall (Back) */}
            <mesh position={[0, 3.5, -40]}>
                <planeGeometry args={[50, 7]} />
                {wallMaterial}
            </mesh>

            {/* South Wall (Front) */}
            <mesh position={[0, 3.5, 40]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[50, 7]} />
                {wallMaterial}
            </mesh>

            {/* West Wall (Left) */}
            <mesh position={[-25, 3.5, 0]} rotation={[0, Math.PI / 2, 0]}>
                <planeGeometry args={[80, 7]} />
                {wallMaterial}
            </mesh>

            {/* East Wall (Right) */}
            <mesh position={[25, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]}>
                <planeGeometry args={[80, 7]} />
                {wallMaterial}
            </mesh>

            {/* Slat Pattern Accents integrated into Walls (Luxury Boutique Look) */}
            {/* Left Wall Slats */}
            {[-20, 0, 20].map((zPos, idx) => (
                <group key={`w-slat-l-${idx}`} position={[-24.8, 3.5, zPos]} rotation={[0, Math.PI / 2, 0]}>
                    <mesh position={[0, 0, -0.05]}><boxGeometry args={[6, 7, 0.1]} /><meshStandardMaterial color="#050505" /></mesh>
                    {Array.from({ length: 25 }).map((_, j) => (
                        <mesh key={`slat-lj-${j}`} position={[-3 + j * 0.25, 0, 0.05]}>
                            <boxGeometry args={[0.08, 7, 0.1]} />
                            {woodMaterial}
                        </mesh>
                    ))}
                </group>
            ))}

            {/* Right Wall Slats */}
            {[-15, 15].map((zPos, idx) => (
                <group key={`w-slat-r-${idx}`} position={[24.8, 3.5, zPos]} rotation={[0, -Math.PI / 2, 0]}>
                    <mesh position={[0, 0, -0.05]}><boxGeometry args={[8, 7, 0.1]} /><meshStandardMaterial color="#050505" /></mesh>
                    {Array.from({ length: 32 }).map((_, j) => (
                        <mesh key={`slat-rj-${j}`} position={[-4 + j * 0.25, 0, 0.05]}>
                            <boxGeometry args={[0.08, 7, 0.1]} />
                            {woodMaterial}
                        </mesh>
                    ))}
                </group>
            ))}

            {/* Heavy Baseboards */}
            <mesh position={[0, 0.15, 0]}>
                <boxGeometry args={[50.2, 0.3, 80.2]} />
                {blackTrimMaterial}
            </mesh>
        </group>
    );
}
