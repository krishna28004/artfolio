"use client";

import { useEffect, useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PointerLockControls as DreiPointerLockControls } from "@react-three/drei";
import * as THREE from "three";
import { ARTWORKS, GalleryArtwork } from "./GalleryScene";
import { VISITOR_BOUNDS } from "@/features/artwork/utils/exhibition-validation";
import { moveWithCollision } from "./physics/collision";

export const WALK_SPEED = 3.5;
export const SPRINT_SPEED = 5.8;
export const BASE_EYE_HEIGHT = 1.65;
const BOUNDARY = VISITOR_BOUNDS;

/* Global movement state driven by on-screen HTML buttons (mobile) */
export const movementState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
};

/* Global walk-to target set by double-click or tap on the floor */
export const walkToTarget = {
  active: false,
  x: 0,
  z: 0,
};

export interface ControlsProps {
  artworks?: GalleryArtwork[];
  onFocusArtwork?: (art: GalleryArtwork | null) => void;
  initialPosition?: [number, number, number];
  boundary?: { minX: number; maxX: number; minZ: number; maxZ: number };
  useLegacyHall?: boolean;
  prefersReducedMotion?: boolean;
  onPointerLockChange?: (locked: boolean) => void;
  mouseSensitivity?: number;
}

export function Controls({
  artworks = ARTWORKS,
  onFocusArtwork,
  initialPosition = [0, 1.65, 27],
  boundary = BOUNDARY,
  useLegacyHall = false,
  prefersReducedMotion = false,
  onPointerLockChange,
  mouseSensitivity = 1.0,
}: ControlsProps) {
  const { camera, gl } = useThree();
  const cameraRef = useRef(camera);
  const onFocusArtworkRef = useRef(onFocusArtwork);
  const onPointerLockChangeRef = useRef(onPointerLockChange);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    onFocusArtworkRef.current = onFocusArtwork;
  }, [onFocusArtwork]);

  useEffect(() => {
    onPointerLockChangeRef.current = onPointerLockChange;
  }, [onPointerLockChange]);

  const keys = useRef<Set<string>>(new Set());
  const velocity = useRef(new THREE.Vector3());
  const isPointerLocked = useRef(false);
  const targetAlignQuat = useRef<THREE.Quaternion | null>(null);
  const lastAlignCheck = useRef(0);
  const headBobTimer = useRef(0);
  const tempCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
  const currentlyFocusedId = useRef<string | null>(null);

  // Setup keyboard input listeners and focus cleanup
  useEffect(() => {
    const clearInputs = () => {
      keys.current.clear();
      movementState.forward = false;
      movementState.backward = false;
      movementState.left = false;
      movementState.right = false;
    };

    const down = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input or textarea
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      // Prevent accidental browser scrolling from movement keys only while active
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
        ].includes(e.code)
      ) {
        if (isPointerLocked.current) {
          e.preventDefault();
        }
      }

      keys.current.add(e.code);
      if (
        [
          "KeyW",
          "KeyA",
          "KeyS",
          "KeyD",
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
        ].includes(e.code)
      ) {
        walkToTarget.active = false;
      }
    };

    const up = (e: KeyboardEvent) => {
      keys.current.delete(e.code);
    };

    const handleBlur = () => {
      clearInputs();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearInputs();
      }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    const currentCam = cameraRef.current;
    if (currentCam) {
      currentCam.position.set(initialPosition[0], initialPosition[1], initialPosition[2]);
    }

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInputs();
    };
  }, [initialPosition]);

  // Mobile touch-to-look implementation
  useEffect(() => {
    let lastTouchX = 0;
    let lastTouchY = 0;
    const euler = new THREE.Euler(0, 0, 0, "YXZ");

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        lastTouchX = e.touches[0].pageX;
        lastTouchY = e.touches[0].pageY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const activeCam = cameraRef.current;
      if (!activeCam) return;

      if (e.touches.length === 1) {
        const touchX = e.touches[0].pageX;
        const touchY = e.touches[0].pageY;
        const deltaX = touchX - lastTouchX;
        const deltaY = touchY - lastTouchY;

        euler.setFromQuaternion(activeCam.quaternion);

        // Smooth touch sensitivity
        euler.y -= deltaX * 0.005;
        euler.x -= deltaY * 0.005;

        // Pitch clamp: limit to ±45 degrees
        const limit = (45 * Math.PI) / 180;
        euler.x = Math.max(-limit, Math.min(limit, euler.x));

        activeCam.quaternion.setFromEuler(euler);
        targetAlignQuat.current = null;

        lastTouchX = touchX;
        lastTouchY = touchY;
      }
    };

    const domElement = gl.domElement;
    domElement.addEventListener("touchstart", onTouchStart, { passive: true });
    domElement.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      domElement.removeEventListener("touchstart", onTouchStart);
      domElement.removeEventListener("touchmove", onTouchMove);
    };
  }, [gl.domElement]);

  // Frame update loop: velocity, swept continuous collision, head bob
  useFrame((state, delta) => {
    const cam = state.camera;
    const safeDelta = Math.min(delta, 0.05); // Bounded timestep prevents delta spikes
    const k = keys.current;
    const m = movementState;
    const nowSec = performance.now() / 1000;

    // --- Soft Auto-Alignment & Proximity Detection UX logic ---
    if (nowSec - lastAlignCheck.current > 0.1) {
      lastAlignCheck.current = nowSec;

      let nearest: GalleryArtwork | null = null;
      let minDist = 5.5;

      const activeArtList = artworks.length > 0 ? artworks : ARTWORKS;

      for (const art of activeArtList) {
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
        if (dot > 0.82) {
          if (currentlyFocusedId.current !== nearest.id) {
            currentlyFocusedId.current = nearest.id;
            onFocusArtworkRef.current?.(nearest);
          }

          tempCamera.position.copy(cam.position);
          tempCamera.lookAt(nearest.position[0], cam.position.y, nearest.position[2]);

          const angleDiff = cam.quaternion.angleTo(tempCamera.quaternion);
          if (angleDiff > 0.01 && angleDiff < 0.4) {
            targetAlignQuat.current = tempCamera.quaternion.clone();
          } else {
            targetAlignQuat.current = null;
          }
        } else {
          targetAlignQuat.current = null;
          if (currentlyFocusedId.current !== null) {
            currentlyFocusedId.current = null;
            onFocusArtworkRef.current?.(null);
          }
        }
      } else {
        targetAlignQuat.current = null;
        if (currentlyFocusedId.current !== null) {
          currentlyFocusedId.current = null;
          onFocusArtworkRef.current?.(null);
        }
      }
    }

    // Apply smooth slerp if auto-aligning to artwork
    if (targetAlignQuat.current && !walkToTarget.active) {
      cam.quaternion.slerp(targetAlignQuat.current, safeDelta * 4);
    }

    // --- Double-click / tap walk-to logic with collision safety ---
    if (walkToTarget.active) {
      const dx = walkToTarget.x - cam.position.x;
      const dz = walkToTarget.z - cam.position.z;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.2) {
        walkToTarget.active = false;
        velocity.current.set(0, 0, 0);
      } else {
        const moveVel = {
          x: (dx / dist) * WALK_SPEED,
          z: (dz / dist) * WALK_SPEED,
        };

        if (useLegacyHall) {
          cam.position.x += moveVel.x * safeDelta;
          cam.position.z += moveVel.z * safeDelta;
          cam.position.x = Math.max(boundary.minX, Math.min(boundary.maxX, cam.position.x));
          cam.position.z = Math.max(boundary.minZ, Math.min(boundary.maxZ, cam.position.z));
        } else {
          const res = moveWithCollision(
            { x: cam.position.x, z: cam.position.z },
            moveVel,
            safeDelta
          );
          cam.position.x = res.position.x;
          cam.position.z = res.position.z;
          if (res.collided) {
            walkToTarget.active = false;
          }
        }
      }

      cam.position.y = THREE.MathUtils.damp(cam.position.y, BASE_EYE_HEIGHT, 5, safeDelta);
      return;
    }

    // --- Manual First-Person Movement (WASD / Arrows / Shift Sprint) ---
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    cam.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const inputDir = new THREE.Vector3();
    if (k.has("KeyW") || k.has("ArrowUp") || m.forward) inputDir.add(forward);
    if (k.has("KeyS") || k.has("ArrowDown") || m.backward) inputDir.sub(forward);
    if (k.has("KeyA") || k.has("ArrowLeft") || m.left) inputDir.sub(right);
    if (k.has("KeyD") || k.has("ArrowRight") || m.right) inputDir.add(right);

    // Sprint modifier
    const isSprinting = k.has("ShiftLeft") || k.has("ShiftRight");
    const targetSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;

    let hasInput = false;
    let targetVelX = 0;
    let targetVelZ = 0;

    if (inputDir.lengthSq() > 0.0001) {
      inputDir.normalize(); // Normalized diagonal: guarantees diagonal speed == straight line speed
      hasInput = true;
      targetVelX = inputDir.x * targetSpeed;
      targetVelZ = inputDir.z * targetSpeed;
      targetAlignQuat.current = null;
    }

    // Frame-rate independent exponential acceleration & deceleration
    const decayRate = hasInput ? 14.0 : 16.0;
    const damp = 1.0 - Math.exp(-decayRate * safeDelta);

    velocity.current.x += (targetVelX - velocity.current.x) * damp;
    velocity.current.z += (targetVelZ - velocity.current.z) * damp;

    if (!hasInput && Math.hypot(velocity.current.x, velocity.current.z) < 0.01) {
      velocity.current.set(0, 0, 0);
    }

    // Apply continuous swept collision
    if (useLegacyHall) {
      cam.position.x += velocity.current.x * safeDelta;
      cam.position.z += velocity.current.z * safeDelta;
      cam.position.x = Math.max(boundary.minX, Math.min(boundary.maxX, cam.position.x));
      cam.position.z = Math.max(boundary.minZ, Math.min(boundary.maxZ, cam.position.z));
    } else {
      const curPos = { x: cam.position.x, z: cam.position.z };
      const reqVel = { x: velocity.current.x, z: velocity.current.z };
      const col = moveWithCollision(curPos, reqVel, safeDelta);

      cam.position.x = col.position.x;
      cam.position.z = col.position.z;

      // Preserve tangential sliding velocity so gliding along walls is natural
      velocity.current.x = col.resolvedVelocity.x;
      velocity.current.z = col.resolvedVelocity.z;
    }

    // --- Subtle Walking Head-Bob Effect ---
    const moveSpeed = Math.hypot(velocity.current.x, velocity.current.z);
    if (!prefersReducedMotion && moveSpeed > 0.2) {
      const bobFreq = isSprinting ? 12.0 : 8.5;
      headBobTimer.current += safeDelta * bobFreq;
      const bobAmp = isSprinting ? 0.025 : 0.018; // Max 2.5cm vertical displacement
      const targetBobY = BASE_EYE_HEIGHT + Math.sin(headBobTimer.current) * bobAmp;
      cam.position.y = THREE.MathUtils.damp(cam.position.y, targetBobY, 12, safeDelta);
    } else {
      cam.position.y = THREE.MathUtils.damp(cam.position.y, BASE_EYE_HEIGHT, 8, safeDelta);
    }
  });

  return (
    <DreiPointerLockControls
      pointerSpeed={mouseSensitivity}
      minPolarAngle={Math.PI / 2 - (45 * Math.PI) / 180}
      maxPolarAngle={Math.PI / 2 + (45 * Math.PI) / 180}
      onLock={() => {
        isPointerLocked.current = true;
        onPointerLockChangeRef.current?.(true);
      }}
      onUnlock={() => {
        isPointerLocked.current = false;
        keys.current.clear();
        movementState.forward = false;
        movementState.backward = false;
        movementState.left = false;
        movementState.right = false;
        onPointerLockChangeRef.current?.(false);
      }}
    />
  );
}
