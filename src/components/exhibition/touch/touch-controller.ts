/**
 * Artfolio Virtual Museum — Mobile & Tablet Touch Controller Engine
 * 
 * High-performance, render-independent mathematical engine and shared state
 * for mobile touch joystick movement, touch-look rotation, and input isolation.
 */

export interface TouchMovementState {
  /** Normalized horizontal movement: -1.0 (full left) to +1.0 (full right) */
  x: number;
  /** Normalized longitudinal movement: +1.0 (full forward) to -1.0 (full backward) */
  y: number;
  /** Whether mobile sprint is active */
  sprint: boolean;
}

export interface TouchLookState {
  /** Accumulated yaw rotation in radians to apply in the next frame */
  deltaYaw: number;
  /** Accumulated pitch rotation in radians to apply in the next frame */
  deltaPitch: number;
}

export interface JoystickCalculation {
  /** Normalized X movement clamped to [-1, 1] */
  x: number;
  /** Normalized Y movement clamped to [-1, 1] (forward is +1) */
  y: number;
  /** Distance of pointer displacement from origin in pixels */
  distance: number;
  /** Direction angle in radians */
  angle: number;
  /** Knob visual displacement X in pixels (bounded by maxRadius) */
  knobX: number;
  /** Knob visual displacement Y in pixels (bounded by maxRadius) */
  knobY: number;
  /** Whether displacement exceeds the deadzone threshold */
  isEngaged: boolean;
}

export const DEFAULT_JOYSTICK_RADIUS = 50;
export const DEFAULT_DEADZONE = 6;
export const MAX_PITCH_ANGLE = (45 * Math.PI) / 180; // ±45 degrees in radians (0.785398 rad)

export const WALK_SPEED = 3.5;
export const SPRINT_SPEED = 5.8;

export const DEFAULT_TOUCH_SENSITIVITY = {
  yaw: 0.0035,
  pitch: 0.0035,
};

/**
 * Computes normalized joystick directional vectors and knob offset.
 * Screen coordinates: dx > 0 is right, dy > 0 is downward.
 * 3D movement coordinates: x > 0 is right, y > 0 is forward (so dy is inverted).
 * 
 * Enforces strict diagonal normalization: magnitude is capped at 1.0 so diagonal
 * walking speed never exceeds maximum straight-line walking speed.
 */
export function computeJoystickInput(
  dx: number,
  dy: number,
  maxRadius: number = DEFAULT_JOYSTICK_RADIUS,
  deadZone: number = DEFAULT_DEADZONE
): JoystickCalculation {
  const distance = Math.hypot(dx, dy);

  if (distance < deadZone) {
    return {
      x: 0,
      y: 0,
      distance: 0,
      angle: 0,
      knobX: 0,
      knobY: 0,
      isEngaged: false,
    };
  }

  const angle = Math.atan2(dy, dx);
  const clampedDistance = Math.min(distance, maxRadius);

  const rawKnobX = Math.cos(angle) * clampedDistance;
  const rawKnobY = Math.sin(angle) * clampedDistance;
  const knobX = Math.abs(rawKnobX) < 1e-12 ? 0 : rawKnobX;
  const knobY = Math.abs(rawKnobY) < 1e-12 ? 0 : rawKnobY;

  // Raw values before diagonal normalization (clean negative zeros)
  const rawX = dx === 0 ? 0 : dx / maxRadius;
  const rawY = dy === 0 ? 0 : -dy / maxRadius; // Invert dy so pushing up on screen moves forward

  const mag = Math.hypot(rawX, rawY);
  let nx = rawX;
  let ny = rawY;

  // Strict diagonal normalization: if magnitude exceeds 1.0, scale down to unit vector
  if (mag > 1.0) {
    nx = rawX / mag;
    ny = rawY / mag;
  }

  if (Math.abs(nx) < 1e-12) nx = 0;
  if (Math.abs(ny) < 1e-12) ny = 0;

  return {
    x: nx,
    y: ny,
    distance,
    angle,
    knobX,
    knobY,
    isEngaged: true,
  };
}

/**
 * Clamps camera pitch (vertical rotation) to prevent tumbling or inversion.
 * Matches DreiPointerLockControls min/max polar angles (Math.PI / 2 ± 45°).
 */
export function clampPitch(
  currentPitch: number,
  deltaPitch: number,
  maxPitch: number = MAX_PITCH_ANGLE
): number {
  const target = currentPitch - deltaPitch;
  return Math.max(-maxPitch, Math.min(maxPitch, target));
}

/**
 * Shared mutable state singletons for high-performance controller consumption.
 * These are polled inside useFrame without triggering React re-renders.
 */
export const touchMovementState: TouchMovementState = {
  x: 0,
  y: 0,
  sprint: false,
};

export const touchLookState: TouchLookState = {
  deltaYaw: 0,
  deltaPitch: 0,
};

/**
 * Resets touch movement to neutral.
 */
export function resetTouchMovementState(): void {
  touchMovementState.x = 0;
  touchMovementState.y = 0;
  touchMovementState.sprint = false;
}

/**
 * Resets accumulated touch-look delta.
 */
export function resetTouchLookState(): void {
  touchLookState.deltaYaw = 0;
  touchLookState.deltaPitch = 0;
}

/**
 * Clears all active touch inputs (called on blur, modal open, or orientation change).
 */
export function resetAllTouchInput(): void {
  resetTouchMovementState();
  resetTouchLookState();
}

/**
 * Feature detection: checks if the current device/browser supports touch input.
 * Avoids user-agent sniffing.
 */
export function isTouchCapable(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    (typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches)
  );
}

/**
 * Checks if the user is strictly on a desktop device with a fine pointer (mouse)
 * and no coarse touch capabilities.
 */
export function isFinePointerOnly(): boolean {
  if (typeof window === "undefined") return true;
  const hasFinePointer =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const noTouchPoints =
    typeof navigator === "undefined" || navigator.maxTouchPoints === 0;
  return hasFinePointer && noTouchPoints;
}
