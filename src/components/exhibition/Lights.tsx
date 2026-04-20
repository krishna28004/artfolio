export function Lights() {
    return (
        <>
            {/* 1. Global Fill */}
            <hemisphereLight args={["#ffffff", "#222222", 0.7]} />
            
            {/* 2. Soft Ambient */}
            <ambientLight intensity={0.5} color="#fffcf5" />

            {/* 3. Single Shadow Caster */}
            <directionalLight position={[0, 20, 5]} intensity={1.2} color="#ffedd6" castShadow={false} />
        </>
    );
}
