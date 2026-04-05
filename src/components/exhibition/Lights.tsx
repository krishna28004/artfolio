export function Lights() {
    return (
        <>
            {/* Global Warm Ambience (Low Intensity) */}
            <ambientLight intensity={0.1} color="#ffcc80" />

            {/* High-Level Soft Fill Lights for a 'Glow' look */}
            <pointLight position={[15, 6, 15]} intensity={0.5} color="#ffd4a3" distance={30} decay={2} />
            <pointLight position={[-15, 6, 15]} intensity={0.5} color="#ffd4a3" distance={30} decay={2} />
            <pointLight position={[0, 6, -15]} intensity={0.8} color="#ffd4a3" distance={40} decay={1.5} />
            <pointLight position={[0, 6, 25]} intensity={0.4} color="#ffd4a3" distance={30} decay={2} />
        </>
    );
}
