import { useEffect, useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { ARTWORKS } from "./GalleryScene";

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
    const { camera, gl } = useThree();
    const keys = useRef<Set<string>>(new Set());
    const targetAlignQuat = useRef<THREE.Quaternion | null>(null);
    const lastAlignCheck = useRef(0);
    const tempCamera = useMemo(() => new THREE.PerspectiveCamera(), []);

    // Setup input listeners
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            keys.current.add(e.code);
            if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
                walkToTarget.active = false;
            }
        };
        const up = (e: KeyboardEvent) => keys.current.delete(e.code);
        window.addEventListener("keydown", down);
        window.addEventListener("keyup", up);
        camera.position.set(0, 1.6, 18);
        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }, [camera]);

    // Mobile touch-to-look implementation
    useEffect(() => {
        let lastTouchX = 0;
        let lastTouchY = 0;
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');

        const onTouchStart = (e: TouchEvent) => {
            if (e.touches.length > 0) {
                lastTouchX = e.touches[0].pageX;
                lastTouchY = e.touches[0].pageY;
            }
        };

        const onTouchMove = (e: TouchEvent) => {
            // Only capture look if not using multi-touch
            if (e.touches.length === 1) {
                const touchX = e.touches[0].pageX;
                const touchY = e.touches[0].pageY;
                const deltaX = touchX - lastTouchX;
                const deltaY = touchY - lastTouchY;

                euler.setFromQuaternion(camera.quaternion);
                
                // Sensitivity modifier
                euler.y -= deltaX * 0.005;
                euler.x -= deltaY * 0.005;

                // Pitch clamp: limit to ±30 degrees
                const limit = 30 * Math.PI / 180;
                euler.x = Math.max(-limit, Math.min(limit, euler.x));

                camera.quaternion.setFromEuler(euler);

                // Cancel alignment if user manually scrolls
                targetAlignQuat.current = null;

                lastTouchX = touchX;
                lastTouchY = touchY;
            }
        };

        const domElement = gl.domElement;
        domElement.addEventListener('touchstart', onTouchStart, { passive: true });
        domElement.addEventListener('touchmove', onTouchMove, { passive: false }); // allow preventDefault if needed later

        return () => {
            domElement.removeEventListener('touchstart', onTouchStart);
            domElement.removeEventListener('touchmove', onTouchMove);
        };
    }, [camera, gl.domElement]);

    const velocity = useRef(new THREE.Vector3());

    useFrame((state, delta) => {
        const safeDelta = Math.min(delta, 0.1);
        const k = keys.current;
        const m = movementState;

        // --- Soft Auto-Alignment UX logic ---
        // Throttle proximity scan (0.1s interval = 10Hz) to prevent O(n) frame stall
        if (state.clock.elapsedTime - lastAlignCheck.current > 0.1) {
            lastAlignCheck.current = state.clock.elapsedTime;
            
            let nearest: typeof ARTWORKS[0] | null = null;
            let minDist = 6.0; // Only trigger in proximity

            for (const art of ARTWORKS) {
                const dx = art.position[0] - camera.position.x;
                const dz = art.position[2] - camera.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = art;
                }
            }

            if (nearest && !walkToTarget.active) {
                const dirToArt = new THREE.Vector3(
                    nearest.position[0] - camera.position.x,
                    nearest.position[1] - camera.position.y,
                    nearest.position[2] - camera.position.z
                ).normalize();

                const forward = new THREE.Vector3();
                camera.getWorldDirection(forward);

                const dot = forward.dot(dirToArt);
                // Requires strong gaze lock (over 0.85) to avoid feeling "forced"
                if (dot > 0.85) {
                    tempCamera.position.copy(camera.position);
                    // Keep horizon absolutely stable by aligning only yaw
                    tempCamera.lookAt(nearest.position[0], camera.position.y, nearest.position[2]);
                    
                    const angleDiff = camera.quaternion.angleTo(tempCamera.quaternion);
                    // Deadzone: stop near 0.01 to prevent micro-jitter, and max diff 0.4 keeps it from whipping around
                    if (angleDiff > 0.01 && angleDiff < 0.4) {
                        targetAlignQuat.current = tempCamera.quaternion.clone();
                    } else {
                        targetAlignQuat.current = null;
                    }
                } else {
                    targetAlignQuat.current = null; // User looked away
                }
            } else {
                targetAlignQuat.current = null;
            }
        }

        // Apply smooth slerp if active
        if (targetAlignQuat.current && !walkToTarget.active) {
            camera.quaternion.slerp(targetAlignQuat.current, safeDelta * 4);
        }

        // --- Double-click walk-to logic ---
        if (walkToTarget.active) {
            camera.position.x = THREE.MathUtils.damp(camera.position.x, walkToTarget.x, 3, safeDelta);
            camera.position.z = THREE.MathUtils.damp(camera.position.z, walkToTarget.z, 3, safeDelta);
            
            const distSq = Math.pow(walkToTarget.x - camera.position.x, 2) + Math.pow(walkToTarget.z - camera.position.z, 2);
            if (distSq < 0.02) {
                walkToTarget.active = false;
            }
            camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.6, 5, safeDelta);
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
            velocity.current.add(dir.multiplyScalar(25 * safeDelta)); // Intentionally smooth acceleration
            
            // Cancel alignment if user starts walking
            targetAlignQuat.current = null;
        }

        // Velocity damping (smooth deceleration)
        velocity.current.multiplyScalar(0.82); 
        if (velocity.current.lengthSq() < 0.001) velocity.current.set(0, 0, 0);

        camera.position.x += velocity.current.x * safeDelta;
        camera.position.z += velocity.current.z * safeDelta;

        // Strict boundary clamping to prevent clipping through walls
        camera.position.x = Math.max(BOUNDARY.minX, Math.min(BOUNDARY.maxX, camera.position.x));
        camera.position.z = Math.max(BOUNDARY.minZ, Math.min(BOUNDARY.maxZ, camera.position.z));
        
        // Soft Y height handling — strict 1.6 eye-level
        camera.position.y = THREE.MathUtils.damp(camera.position.y, 1.6, 5, safeDelta);
    });

    // We use PointerLockControls, locking max/min polar angles to ±30 degrees from horizontal
    return <PointerLockControls minPolarAngle={Math.PI / 2 - 30 * Math.PI / 180} maxPolarAngle={Math.PI / 2 + 30 * Math.PI / 180} />;
}
