"use client";
/* eslint-disable react-hooks/immutability */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

const SPEED = 4;
const WALK_TO_SPEED = 3;
const BOUNDARY = { minX: -14, maxX: 14, minZ: -24, maxZ: 24 };

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

    useFrame((_, delta) => {
        const safeDelta = Math.min(delta, 0.1);
        const k = keys.current;
        const m = movementState;

        // --- Double-click walk-to logic ---
        if (walkToTarget.active) {
            const dx = walkToTarget.x - camera.position.x;
            const dz = walkToTarget.z - camera.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < 0.3) {
                walkToTarget.active = false;
            } else {
                const step = Math.min(WALK_TO_SPEED * safeDelta, dist);
                camera.position.x += (dx / dist) * step;
                camera.position.z += (dz / dist) * step;
                camera.position.x = Math.max(BOUNDARY.minX, Math.min(BOUNDARY.maxX, camera.position.x));
                camera.position.z = Math.max(BOUNDARY.minZ, Math.min(BOUNDARY.maxZ, camera.position.z));
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
            dir.normalize().multiplyScalar(SPEED * safeDelta);
            camera.position.x = Math.max(BOUNDARY.minX, Math.min(BOUNDARY.maxX, camera.position.x + dir.x));
            camera.position.z = Math.max(BOUNDARY.minZ, Math.min(BOUNDARY.maxZ, camera.position.z + dir.z));
        }
        camera.position.y = 1.7;
    });

    return <PointerLockControls />;
}
