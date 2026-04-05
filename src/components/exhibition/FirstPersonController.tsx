"use client";
/* eslint-disable react-hooks/immutability */
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";

const SPEED = 5; // units per second
const BOUNDARY = { minX: -18, maxX: 18, minZ: -18, maxZ: 18 };

export function FirstPersonController() {
    const { camera } = useThree();
    const keys = useRef<Set<string>>(new Set());
    const direction = useRef(new THREE.Vector3());

    useEffect(() => {
        const onKey = (e: KeyboardEvent, down: boolean) => {
            if (down) keys.current.add(e.code);
            else keys.current.delete(e.code);
        };
        window.addEventListener("keydown", (e) => onKey(e, true));
        window.addEventListener("keyup", (e) => onKey(e, false));
        camera.position.set(0, 1.7, 3); // player eye height
        return () => {
            window.removeEventListener("keydown", (e) => onKey(e, true));
            window.removeEventListener("keyup", (e) => onKey(e, false));
        };
    }, [camera]);

    useFrame((_, delta) => {
        const k = keys.current;
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        direction.current.set(0, 0, 0);
        if (k.has("KeyW") || k.has("ArrowUp")) direction.current.add(forward);
        if (k.has("KeyS") || k.has("ArrowDown")) direction.current.sub(forward);
        if (k.has("KeyA") || k.has("ArrowLeft")) direction.current.sub(right);
        if (k.has("KeyD") || k.has("ArrowRight")) direction.current.add(right);

        if (direction.current.lengthSq() > 0) {
            direction.current.normalize();
            const move = direction.current.multiplyScalar(SPEED * delta);
            const newX = Math.max(BOUNDARY.minX, Math.min(BOUNDARY.maxX, camera.position.x + move.x));
            const newZ = Math.max(BOUNDARY.minZ, Math.min(BOUNDARY.maxZ, camera.position.z + move.z));
            camera.position.x = newX;
            camera.position.z = newZ;
        }
        camera.position.y = 1.7; // always stay at eye level
    });

    return <PointerLockControls />;
}
