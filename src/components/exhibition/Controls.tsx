"use client";

import { useEffect, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  safeRequestPointerLock,
  safeExitPointerLock,
  resetPointerLockPending,
} from "./controllers/pointer-lock-manager";
import * as THREE from "three";
import { ARTWORKS, GalleryArtwork } from "./GalleryScene";
import { VISITOR_BOUNDS } from "@/features/artwork/utils/exhibition-validation";
import { moveWithCollision, hasLineOfSight, isPositionWalkable, DEFAULT_COLLISION_CONFIG } from "./physics/collision";
import {
  touchMovementState,
  touchLookState,
  resetAllTouchInput,
  clampPitch,
  isTouchCapable,
  isFinePointerOnly,
} from "./touch/touch-controller";

export const WALK_SPEED = 3.5;
export const SPRINT_SPEED = 5.8;
export const BASE_EYE_HEIGHT = 1.65;
const BOUNDARY = VISITOR_BOUNDS;
const DEFAULT_SPAWN: [number, number, number] = [0, 1.65, 27];
const MOVEMENT_KEYS = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export interface PlayerPose {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

function restorePlayerPose(poseRef: RefObject<PlayerPose | null>, camera: THREE.Camera, spawn: [number, number, number]) {
  if (!poseRef.current) {
    camera.position.set(...spawn);
    poseRef.current = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
  } else {
    camera.position.copy(poseRef.current.position);
    camera.quaternion.copy(poseRef.current.quaternion);
  }
}

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
  isModalOpen?: boolean;
  playerPoseRef?: RefObject<PlayerPose | null>;
}

export function Controls({
  artworks = ARTWORKS,
  onFocusArtwork,
  initialPosition = DEFAULT_SPAWN,
  boundary = BOUNDARY,
  useLegacyHall = false,
  prefersReducedMotion = false,
  onPointerLockChange,
  mouseSensitivity = 1.0,
  isModalOpen = false,
  playerPoseRef,
}: ControlsProps) {
  const { camera, gl } = useThree();
  const setEvents = useThree((state) => state.setEvents);
  const get = useThree((state) => state.get);
  const cameraRef = useRef(camera);
  const onFocusArtworkRef = useRef(onFocusArtwork);
  const onPointerLockChangeRef = useRef(onPointerLockChange);
  const isModalOpenRef = useRef(isModalOpen);
  const mouseSensitivityRef = useRef(mouseSensitivity);
  const keys = useRef<Set<string>>(new Set());
  const velocity = useRef(new THREE.Vector3());
  const localPoseRef = useRef<PlayerPose | null>(null);
  const poseRef = playerPoseRef ?? localPoseRef;
  const spawnRef = useRef(initialPosition);

  // Spawn is only an initial-entry value. Parent UI renders must never reapply it.
  useEffect(() => {
    restorePlayerPose(poseRef, camera, spawnRef.current);
  }, [camera, poseRef]);

  useEffect(() => {
    mouseSensitivityRef.current = mouseSensitivity;
  }, [mouseSensitivity]);

  useEffect(() => {
    isModalOpenRef.current = isModalOpen;
    keys.current.clear();
    velocity.current.set(0, 0, 0);
    movementState.forward = movementState.backward = movementState.left = movementState.right = false;
    walkToTarget.active = false;
    resetAllTouchInput();
    if (isModalOpen) {
      safeExitPointerLock(document);
    }
  }, [isModalOpen]);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  useEffect(() => {
    onFocusArtworkRef.current = onFocusArtwork;
  }, [onFocusArtwork]);

  useEffect(() => {
    onPointerLockChangeRef.current = onPointerLockChange;
  }, [onPointerLockChange]);

  const isPointerLocked = useRef(false);
  const lastFocusCheck = useRef(0);
  const headBobTimer = useRef(0);
  const currentlyFocusedId = useRef<string | null>(null);

  // Setup keyboard input listeners and focus cleanup
  useEffect(() => {
    const clearInputs = () => {
      keys.current.clear();
      velocity.current.set(0, 0, 0);
      walkToTarget.active = false;
      movementState.forward = false;
      movementState.backward = false;
      movementState.left = false;
      movementState.right = false;
      resetAllTouchInput();
    };

    const down = (e: KeyboardEvent) => {
      // Ignore if modal is open or user is typing in an input or textarea
      if (
        isModalOpenRef.current ||
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT" ||
        (document.activeElement as HTMLElement | null)?.isContentEditable
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

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInputs();
    };
  }, []);

  // Setup safe desktop pointer-lock lifecycle:
  // - Listens to clicks strictly on the WebGL canvas (NOT document)
  // - Enforces touch device isolation (never triggers on mobile/tablet)
  // - Handles pointerlockchange and pointerlockerror gracefully
  // - Automatically clamps vertical pitch to [-45°, 45°]
  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;

    let cleanupComputeOffsets: (() => void) | null = null;

    const handleCanvasClick = () => {
      if (isModalOpenRef.current) return;
      if (isTouchCapable() && !isFinePointerOnly()) return;
      if (isPointerLocked.current) return;

      safeRequestPointerLock(canvas, {
        isTouchDevice: isTouchCapable() && !isFinePointerOnly(),
      }).catch(() => {
        // Suppress any uncaught rejections
      });
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isPointerLocked.current || isModalOpenRef.current) return;

      const cam = cameraRef.current;
      if (!cam) return;

      const sensitivity = mouseSensitivityRef.current;
      if (![event.movementX, event.movementY, sensitivity].every(Number.isFinite)) return;
      const MOUSE_SENSITIVITY = 0.002 * sensitivity;

      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.setFromQuaternion(cam.quaternion);

      euler.y -= event.movementX * MOUSE_SENSITIVITY;
      euler.x -= event.movementY * MOUSE_SENSITIVITY;

      // Vertical pitch clamp: ±45 degrees (matching polar angles Math.PI / 2 ± 45 deg)
      const maxPitch = (45 * Math.PI) / 180;
      euler.x = Math.max(-maxPitch, Math.min(maxPitch, euler.x));

      cam.quaternion.setFromEuler(euler);
      poseRef.current?.quaternion.copy(cam.quaternion);
    };

    const handlePointerLockChange = () => {
      const doc = canvas.ownerDocument || document;
      const isLocked = doc.pointerLockElement === canvas;
      // An asynchronous request may complete after artwork inspection has opened.
      // Never capture the cursor over a modal, even if the request began earlier.
      if (isLocked && isModalOpenRef.current) {
        safeExitPointerLock(doc);
        return;
      }
      isPointerLocked.current = isLocked;
      resetPointerLockPending();

      if (isLocked && !cleanupComputeOffsets) {
        // Center R3F pointer compute for crosshair raycasting
        const oldCompute = get().events.compute;
        setEvents({
          compute(event, state) {
            const offsetX = state.size.width / 2;
            const offsetY = state.size.height / 2;
            state.pointer.set(
              (offsetX / state.size.width) * 2 - 1,
              -(offsetY / state.size.height) * 2 + 1
            );
            state.raycaster.setFromCamera(state.pointer, state.camera);
          },
        });
        cleanupComputeOffsets = () => {
          setEvents({ compute: oldCompute });
        };
      } else if (!isLocked) {
        if (cleanupComputeOffsets) {
          cleanupComputeOffsets();
          cleanupComputeOffsets = null;
        }
        keys.current.clear();
        velocity.current.set(0, 0, 0);
        walkToTarget.active = false;
        movementState.forward = false;
        movementState.backward = false;
        movementState.left = false;
        movementState.right = false;
        resetAllTouchInput();
      }

      onPointerLockChangeRef.current?.(isLocked);
    };

    const handlePointerLockError = () => {
      resetPointerLockPending();
      if (process.env.NODE_ENV !== "production") {
        console.debug("[POINTER_LOCK_ERROR] Browser pointer-lock error event received safely");
      }
    };

    canvas.addEventListener("click", handleCanvasClick);
    const doc = canvas.ownerDocument || document;
    doc.addEventListener("mousemove", handleMouseMove);
    doc.addEventListener("pointerlockchange", handlePointerLockChange);
    doc.addEventListener("pointerlockerror", handlePointerLockError);

    return () => {
      canvas.removeEventListener("click", handleCanvasClick);
      doc.removeEventListener("mousemove", handleMouseMove);
      doc.removeEventListener("pointerlockchange", handlePointerLockChange);
      doc.removeEventListener("pointerlockerror", handlePointerLockError);
      if (cleanupComputeOffsets) {
        cleanupComputeOffsets();
      }
      safeExitPointerLock(doc);
      resetPointerLockPending();
    };
  }, [gl, get, setEvents, poseRef]);

  // Frame update loop: velocity, swept continuous collision, head bob
  useFrame((state, delta) => {
    if (isModalOpenRef.current) {
      velocity.current.set(0, 0, 0);
      resetAllTouchInput();
      return;
    }

    const cam = state.camera;
    const safeDelta = Number.isFinite(delta) ? Math.max(0, Math.min(delta, 0.05)) : 0;
    const pose = poseRef.current;
    if (!pose) return;
    if (![cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)) {
      cam.position.copy(pose.position);
      velocity.current.set(0, 0, 0);
      walkToTarget.active = false;
    }
    const orientationLength = cam.quaternion.lengthSq();
    if (!Number.isFinite(orientationLength) || orientationLength < 1e-12) cam.quaternion.copy(pose.quaternion);
    else if (Math.abs(orientationLength - 1) > 1e-6) cam.quaternion.normalize();
    if (![velocity.current.x, velocity.current.z].every(Number.isFinite)) velocity.current.set(0, 0, 0);
    if (![touchMovementState.x, touchMovementState.y, touchLookState.deltaYaw, touchLookState.deltaPitch].every(Number.isFinite)) resetAllTouchInput();
    if (![walkToTarget.x, walkToTarget.z].every(Number.isFinite)) walkToTarget.active = false;
    const rememberPose = () => {
      if ([cam.position.x, cam.position.y, cam.position.z].every(Number.isFinite)
        && (useLegacyHall || isPositionWalkable({ x: cam.position.x, z: cam.position.z }, DEFAULT_COLLISION_CONFIG.playerRadius - 1e-7))) {
        pose.position.copy(cam.position);
        pose.quaternion.copy(cam.quaternion);
      } else {
        cam.position.copy(pose.position);
        velocity.current.set(0, 0, 0);
        walkToTarget.active = false;
      }
    };

    // --- Mobile Touch-Look Rotation ---
    if (touchLookState.deltaYaw !== 0 || touchLookState.deltaPitch !== 0) {
      const euler = new THREE.Euler(0, 0, 0, "YXZ");
      euler.setFromQuaternion(cam.quaternion);

      euler.y -= touchLookState.deltaYaw;
      euler.x = clampPitch(euler.x, touchLookState.deltaPitch);

      cam.quaternion.setFromEuler(euler);

      touchLookState.deltaYaw = 0;
      touchLookState.deltaPitch = 0;
    }

    const k = keys.current;
    const m = movementState;
    if (walkToTarget.active && (
      MOVEMENT_KEYS.some((code) => k.has(code)) || m.forward || m.backward || m.left || m.right ||
      Math.abs(touchMovementState.x) > 0.001 || Math.abs(touchMovementState.y) > 0.001
    )) walkToTarget.active = false;
    const nowSec = performance.now() / 1000;

    // Targeting reports focus only; it never steers or moves the visitor.
    if (nowSec - lastFocusCheck.current > 0.1) {
      lastFocusCheck.current = nowSec;

      let nearest: GalleryArtwork | null = null;
      let minDist = 5.5;

      const activeArtList = artworks.length > 0 ? artworks : ARTWORKS;

      for (const art of activeArtList) {
        const dx = art.position[0] - cam.position.x;
        const dz = art.position[2] - cam.position.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDist) {
          // Check line-of-sight to prevent targeting artwork behind solid walls
          const canSee = useLegacyHall || hasLineOfSight(
            { x: cam.position.x, z: cam.position.z },
            { x: art.position[0], z: art.position[2] }
          );
          if (canSee) {
            minDist = dist;
            nearest = art;
          }
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

        } else {
          if (currentlyFocusedId.current !== null) {
            currentlyFocusedId.current = null;
            onFocusArtworkRef.current?.(null);
          }
        }
      } else {
        if (currentlyFocusedId.current !== null) {
          currentlyFocusedId.current = null;
          onFocusArtworkRef.current?.(null);
        }
      }
    }

    // --- Double-click / tap walk-to logic with collision safety ---
    if (walkToTarget.active) {
      velocity.current.set(0, 0, 0);
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
      rememberPose();
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

    // Mobile Virtual Joystick Analog/Normalized Input
    const tm = touchMovementState;
    if (Math.abs(tm.x) > 0.001 || Math.abs(tm.y) > 0.001) {
      // tm.y > 0 is forward, tm.x > 0 is right
      inputDir.addScaledVector(forward, THREE.MathUtils.clamp(tm.y, -1, 1));
      inputDir.addScaledVector(right, THREE.MathUtils.clamp(tm.x, -1, 1));
    }

    // Sprint modifier: Keyboard Shift OR Mobile Sprint toggle
    const isSprinting = k.has("ShiftLeft") || k.has("ShiftRight") || tm.sprint;
    const targetSpeed = isSprinting ? SPRINT_SPEED : WALK_SPEED;

    let hasInput = false;
    let targetVelX = 0;
    let targetVelZ = 0;

    if (inputDir.lengthSq() > 0.0001) {
      inputDir.divideScalar(Math.max(1, inputDir.length())); // Cap diagonals, preserve analog magnitude.
      hasInput = true;
      targetVelX = inputDir.x * targetSpeed;
      targetVelZ = inputDir.z * targetSpeed;
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
    rememberPose();
  });

  return null;
}
