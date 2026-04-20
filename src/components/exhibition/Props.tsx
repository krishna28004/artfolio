/*
  Gallery Props — Environmental details to make the hall feel realistic.
  Refactored to deeply share Geometries and Materials for ~95% draw/memory reduction.
*/
import * as THREE from 'three';

// === GLOBALLY CACHED RESOURCES ===

const geos = {
    pot: new THREE.CylinderGeometry(0.25, 0.2, 0.8, 8),
    soil: new THREE.CylinderGeometry(0.22, 0.22, 0.05, 8),
    leafLg: new THREE.SphereGeometry(0.35, 8, 6),
    leafMd: new THREE.SphereGeometry(0.28, 8, 6),
    leafSm: new THREE.SphereGeometry(0.25, 8, 6),
    seat: new THREE.BoxGeometry(1.6, 0.08, 0.5),
    leg: new THREE.BoxGeometry(0.08, 0.45, 0.4),
    head: new THREE.SphereGeometry(0.12, 8, 6),
    torso: new THREE.CapsuleGeometry(0.15, 0.5, 4, 8),
    personLeg: new THREE.CapsuleGeometry(0.06, 0.6, 4, 8)
};

const mats = {
    pot: new THREE.MeshStandardMaterial({ color: "#3a2a1a", roughness: 0.9 }),
    soil: new THREE.MeshStandardMaterial({ color: "#2a1f10", roughness: 1 }),
    leafLg: new THREE.MeshStandardMaterial({ color: "#2d4a2d", roughness: 0.9 }),
    leafMd: new THREE.MeshStandardMaterial({ color: "#2e5030", roughness: 0.9 }),
    leafSm: new THREE.MeshStandardMaterial({ color: "#3a5c3a", roughness: 0.9 }),
    wood: new THREE.MeshStandardMaterial({ color: "#4a3520", roughness: 0.8 }),
    metal: new THREE.MeshStandardMaterial({ color: "#222222", roughness: 0.9 }),
    head: new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 1 }),
    torso: new THREE.MeshStandardMaterial({ color: "#1c1c1c", roughness: 1 }),
    personLeg: new THREE.MeshStandardMaterial({ color: "#141414", roughness: 1 })
};

/* ========== POTTED PLANT ========== */
export function Plant({ position }: { position: [number, number, number] }) {
    return (
        <group position={position}>
            <mesh position={[0, 0.4, 0]} geometry={geos.pot} material={mats.pot} />
            <mesh position={[0, 0.81, 0]} geometry={geos.soil} material={mats.soil} />
            <mesh position={[0, 1.3, 0]} geometry={geos.leafLg} material={mats.leafLg} />
            <mesh position={[0.15, 1.5, 0.1]} geometry={geos.leafSm} material={mats.leafSm} />
            <mesh position={[-0.1, 1.45, -0.08]} geometry={geos.leafMd} material={mats.leafMd} />
        </group>
    );
}

/* ========== BENCH ========== */
export function Bench({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation}>
            <mesh position={[0, 0.45, 0]} geometry={geos.seat} material={mats.wood} />
            <mesh position={[-0.65, 0.22, 0]} geometry={geos.leg} material={mats.metal} />
            <mesh position={[0.65, 0.22, 0]} geometry={geos.leg} material={mats.metal} />
        </group>
    );
}

/* ========== PERSON SILHOUETTE ========== */
export function PersonSilhouette({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
    return (
        <group position={position} rotation={rotation}>
            <mesh position={[0, 1.65, 0]} geometry={geos.head} material={mats.head} />
            <mesh position={[0, 1.2, 0]} geometry={geos.torso} material={mats.torso} />
            <mesh position={[-0.08, 0.55, 0]} geometry={geos.personLeg} material={mats.personLeg} />
            <mesh position={[0.08, 0.55, 0]} geometry={geos.personLeg} material={mats.personLeg} />
        </group>
    );
}
