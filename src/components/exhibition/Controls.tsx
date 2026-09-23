import { useEffect, useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { ARTWORKS } from "./GalleryScene";

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
    const cameraRef = useRef(camera);

    useEffect(() => {
        cameraRef.current = camera;
    }, [camera]);

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

        const currentCam = cameraRef.current;
        if (currentCam) {
            currentCam.position.set(0, 1.6, 18);
        }

        return () => {
            window.removeEventListener("keydown", down);
            window.removeEventListener("keyup", up);
        };
    }, []);

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
            const activeCam = cameraRef.current;
            if (!activeCam) return;

            // Only capture look if not using multi-touch
            if (e.touches.length === 1) {
                const touchX = e.touches[0].pageX;
                const touchY = e.touches[0].pageY;
                const deltaX = touchX - lastTouchX;
                const deltaY = touchY - lastTouchY;

                euler.setFromQuaternion(activeCam.quaternion);
                
                // Sensitivity modifier
                euler.y -= deltaX * 0.005;
                euler.x -= deltaY * 0.005;

                // Pitch clamp: limit to ±30 degrees
                const limit = 30 * Math.PI / 180;
                euler.x = Math.max(-limit, Math.min(limit, euler.x));

                activeCam.quaternion.setFromEuler(euler);

                // Cancel alignment if user manually scrolls
                targetAlignQuat.current = null;

                lastTouchX = touchX;
                lastTouchY = touchY;
            }
        };

        const domElement = gl.domElement;
        domElement.addEventListener('touchstart', onTouchStart, { passive: true });
        domElement.addEventListener('touchmove', onTouchMove, { passive: false });

        return () => {
            domElement.removeEventListener('touchstart', onTouchStart);
            domElement.removeEventListener('touchmove', onTouchMove);
        };
    }, [gl.domElement]);

    const velocity = useRef(new THREE.Vector3());

    useFrame((state, delta) => {
        const cam = state.camera;
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
                const dx = art.position[0] - cam.position.x;
                const dz = art.position[2] - cam.position.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = art;
                }
            }

            if (nearest && !walkToTarget.active) {
                const dirToArt = new THREE.Vector3(
                    nearest.position[0] - cam.position.x,
                    nearest.position[1] - cam.position.y,
                    nearest.position[2] - cam.position.z
                ).normalize();

                const forward = new THREE.Vector3();
                cam.getWorldDirection(forward);

                const dot = forward.dot(dirToArt);
                // Requires strong gaze lock (over 0.85) to avoid feeling "forced"
                if (dot > 0.85) {
                    tempCamera.position.copy(cam.position);
                    // Keep horizon absolutely stable by aligning only yaw
                    tempCamera.lookAt(nearest.position[0], cam.position.y, nearest.position[2]);
                    
                    const angleDiff = cam.quaternion.angleTo(tempCamera.quaternion);
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
            cam.quaternion.slerp(targetAlignQuat.current, safeDelta * 4);
        }

        // --- Double-click walk-to logic ---
        if (walkToTarget.active) {
            cam.position.x = THREE.MathUtils.damp(cam.position.x, walkToTarget.x, WALK_TO_SPEED, safeDelta);
            cam.position.z = THREE.MathUtils.damp(cam.position.z, walkToTarget.z, WALK_TO_SPEED, safeDelta);
            
            const distSq = Math.pow(walkToTarget.x - cam.position.x, 2) + Math.pow(walkToTarget.z - cam.position.z, 2);
            if (distSq < 0.02) {
                walkToTarget.active = false;
            }
            cam.position.y = THREE.MathUtils.damp(cam.position.y, 1.6, 5, safeDelta);
            return; // skip manual movement while auto-walking
        }

        // --- Manual movement (keyboard + buttons) ---
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        cam.getWorldDirection(forward);
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

        cam.position.x += velocity.current.x * safeDelta;
        cam.position.z += velocity.current.z * safeDelta;

        // Strict boundary clamping to prevent clipping through walls
        cam.position.x = Math.max(BOUNDARY.minX, Math.min(BOUNDARY.maxX, cam.position.x));
        cam.position.z = Math.max(BOUNDARY.minZ, Math.min(BOUNDARY.maxZ, cam.position.z));
        
        // Soft Y height handling — strict 1.6 eye-level
        cam.position.y = THREE.MathUtils.damp(cam.position.y, 1.6, 5, safeDelta);
    });

    // We use PointerLockControls, locking max/min polar angles to ±30 degrees from horizontal
    return <PointerLockControls minPolarAngle={Math.PI / 2 - 30 * Math.PI / 180} maxPolarAngle={Math.PI / 2 + 30 * Math.PI / 180} />;
}
