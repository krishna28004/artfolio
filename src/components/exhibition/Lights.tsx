export function Lights() {
    return (
        <>
            <hemisphereLight args={["#ffffff", "#222222", 0.5]} />
            
            {/* Soft global ambient fill */}
            <ambientLight intensity={0.3} color="#fffcf5" />

            {/* Subtle volumetric fill lights to create hot-spots in the gallery */}
            <pointLight position={[15, 6, 15]} intensity={1.5} color="#ffedd6" distance={30} decay={2} />
            <pointLight position={[-15, 6, 15]} intensity={1.5} color="#ffedd6" distance={30} decay={2} />
            <pointLight position={[0, 6, -15]} intensity={1.8} color="#ffedd6" distance={40} decay={1.5} />
            <pointLight position={[0, 6, 25]} intensity={1.2} color="#ffedd6" distance={30} decay={2} />
        </>
    );
}
