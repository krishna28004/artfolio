"use client";
/* eslint-disable react-hooks/immutability */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

const SPEED = 4;
const WALK_TO_SPEED = 3;
const BOUNDARY = { minX: -23, maxX: 23, minZ: -38, maxZ: 38 };

/* Global movement state driven by on-screen HTML buttons */
export const movementState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
};

/* Global walk-to target set by double-click on the floor */
export const walkToTarget = {
    active: false,
    x: 0,
    z: 0,
};

export function Controls() {
    const { camera } = useThree();
    const keys = useRef<Set<string>>(new Set());

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            keys.current.add(e.code);
            // Any manual movement cancels auto-walk
            if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
                walkToTarget.active = false;
            }
        };
        const up = (e: KeyboardEvent) => keys.current.delete(e.code);
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        camera.position.set(0, 1.7, 18);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }, [camera]);

    const velocity = useRef(new THREE.Vector3());

    useFrame((_, delta) => {
        const safeDelta = Math.min(delta, 0.1);
        const k = keys.current;
        const m = movementState;

        // --- Double-click walk-to logic ---
        if (walkToTarget.active) {
            camera.position.x = THREE.MathUtils.damp(camera.position.x, walkToTarget.x, 3, safeDelta);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, walkToTarget.z, 3, safeDelta);
            
            const distSq = Math.pow(walkToTarget.x - camera.position.x, 2) + Math.pow(walkToTarget.z - camera.position.z, 2);
            if (distSq < 0.02) {
                walkToTarget.active = false;
            }
            camera.position.y = 1.7;
            return; // skip manual movement while auto-walking
        }

        // --- Manual movement (keyboard + buttons) ---
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const dir = new THREE.Vector3();
        if (k.has("KeyW") || k.has("ArrowUp") || m.forward) dir.add(forward);
        if (k.has("KeyS") || k.has("ArrowDown") || m.backward) dir.sub(forward);
        if (k.has("KeyA") || k.has("ArrowLeft") || m.left) dir.sub(right);
        if (k.has("KeyD") || k.has("ArrowRight") || m.right) dir.add(right);

        if (dir.lengthSq() > 0) {
            dir.normalize();
            velocity.current.add(dir.multiplyScalar(25 * safeDelta)); // acceleration
        }

        // Apply friction
        velocity.current.multiplyScalar(0.82); 
        if (velocity.current.lengthSq() < 0.001) velocity.current.set(0, 0, 0);

        camera.position.x += velocity.current.x * safeDelta;
        camera.position.z += velocity.current.z * safeDelta;

        // Strict boundary clamping
        camera.position.x = Math.max(BOUNDARY.minX, Math.min(BOUNDARY.maxX, camera.position.x));
        camera.position.z = Math.max(BOUNDARY.minZ, Math.min(BOUNDARY.maxZ, camera.position.z));
        camera.position.y = 1.7;
    });

    return <PointerLockControls />;
}
