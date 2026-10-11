import { describe, test } from "node:test";
import assert from "node:assert";
import {
  computeJoystickInput,
  clampPitch,
  touchMovementState,
  touchLookState,
  resetTouchMovementState,
  resetTouchLookState,
  resetAllTouchInput,
  isTouchCapable,
  isFinePointerOnly,
  DEFAULT_JOYSTICK_RADIUS,
  DEFAULT_DEADZONE,
  MAX_PITCH_ANGLE,
  WALK_SPEED,
  SPRINT_SPEED,
} from "@/components/exhibition/touch/touch-controller";

describe("Artfolio Virtual Museum — Phase 4A Mobile & Tablet Controls Tests", () => {
  // ============================================================================
  // 1. JOYSTICK DIRECTIONAL MAPPING
  // ============================================================================
  describe("Joystick Directional Mapping", () => {
    test("pushing straight up on screen moves purely forward (y = 1, x = 0)", () => {
      // Screen coordinates: dy = -50 (upward swipe), dx = 0
      const res = computeJoystickInput(0, -50, 50, 6);
      assert.strictEqual(res.isEngaged, true);
      assert.strictEqual(res.x, 0);
      assert.strictEqual(res.y, 1);
      assert.strictEqual(res.knobX, 0);
      assert.strictEqual(res.knobY, -50);
    });

    test("pulling straight down on screen moves purely backward (y = -1, x = 0)", () => {
      // Screen coordinates: dy = 50 (downward swipe), dx = 0
      const res = computeJoystickInput(0, 50, 50, 6);
      assert.strictEqual(res.isEngaged, true);
      assert.strictEqual(res.x, 0);
      assert.strictEqual(res.y, -1);
      assert.strictEqual(res.knobX, 0);
      assert.strictEqual(res.knobY, 50);
    });

    test("pushing straight right moves purely right (x = 1, y = 0)", () => {
      const res = computeJoystickInput(50, 0, 50, 6);
      assert.strictEqual(res.isEngaged, true);
      assert.strictEqual(res.x, 1);
      assert.strictEqual(res.y, 0);
      assert.strictEqual(res.knobX, 50);
      assert.strictEqual(res.knobY, 0);
    });

    test("pushing straight left moves purely left (x = -1, y = 0)", () => {
      const res = computeJoystickInput(-50, 0, 50, 6);
      assert.strictEqual(res.isEngaged, true);
      assert.strictEqual(res.x, -1);
      assert.strictEqual(res.y, 0);
      assert.strictEqual(res.knobX, -50);
      assert.strictEqual(res.knobY, 0);
    });
  });

  // ============================================================================
  // 2. DIAGONAL NORMALIZATION
  // ============================================================================
  describe("Diagonal Normalization", () => {
    test("diagonal movement is strictly normalized to magnitude 1.0 (1 / sqrt(2))", () => {
      // Forward-right at 45 degrees: dx = 50, dy = -50
      const res = computeJoystickInput(50, -50, 50, 6);
      assert.strictEqual(res.isEngaged, true);

      const magnitude = Math.hypot(res.x, res.y);
      assert.ok(
        Math.abs(magnitude - 1.0) < 1e-6,
        `Diagonal magnitude must be 1.0, got ${magnitude}`
      );

      const expected = 1 / Math.SQRT2;
      assert.ok(
        Math.abs(res.x - expected) < 1e-4,
        `Expected x ≈ ${expected}, got ${res.x}`
      );
      assert.ok(
        Math.abs(res.y - expected) < 1e-4,
        `Expected y ≈ ${expected}, got ${res.y}`
      );
    });

    test("all 4 diagonal quadrants normalize to unit length", () => {
      const quadrants = [
        { dx: 50, dy: -50, name: "North-East" },
        { dx: -50, dy: -50, name: "North-West" },
        { dx: -50, dy: 50, name: "South-West" },
        { dx: 50, dy: 50, name: "South-East" },
      ];

      for (const q of quadrants) {
        const res = computeJoystickInput(q.dx, q.dy, 50, 6);
        const mag = Math.hypot(res.x, res.y);
        assert.ok(
          Math.abs(mag - 1.0) < 1e-6,
          `${q.name} diagonal magnitude must be 1.0, got ${mag}`
        );
      }
    });
  });

  // ============================================================================
  // 3. DEADZONE FILTERING & MAX RADIUS CLAMPING
  // ============================================================================
  describe("Deadzone & Boundary Handling", () => {
    test("small movements within deadzone yield 0 input and 0 knob offset", () => {
      // dx = 3, dy = 4 -> distance = 5 < deadzone 6
      const res = computeJoystickInput(3, 4, DEFAULT_JOYSTICK_RADIUS, DEFAULT_DEADZONE);
      assert.strictEqual(res.isEngaged, false);
      assert.strictEqual(res.x, 0);
      assert.strictEqual(res.y, 0);
      assert.strictEqual(res.knobX, 0);
      assert.strictEqual(res.knobY, 0);
    });

    test("exceeding max radius clamps knob distance to maxRadius without overflow", () => {
      // dx = 120, dy = 0 with maxRadius = 50
      const res = computeJoystickInput(120, 0, 50, 6);
      assert.strictEqual(res.isEngaged, true);
      assert.strictEqual(res.x, 1);
      assert.strictEqual(res.knobX, 50);
      assert.strictEqual(res.knobY, 0);
    });
  });

  // ============================================================================
  // 4. NEUTRAL INPUT & FOCUS CLEANUP
  // ============================================================================
  describe("Neutral Input State & Lifecycle Cleanup", () => {
    test("resetTouchMovementState restores clean zero values", () => {
      touchMovementState.x = 0.75;
      touchMovementState.y = 0.5;
      touchMovementState.sprint = true;

      resetTouchMovementState();

      assert.strictEqual(touchMovementState.x, 0);
      assert.strictEqual(touchMovementState.y, 0);
      assert.strictEqual(touchMovementState.sprint, false);
    });

    test("resetTouchLookState zeroes accumulated rotation deltas", () => {
      touchLookState.deltaYaw = 0.05;
      touchLookState.deltaPitch = -0.02;

      resetTouchLookState();

      assert.strictEqual(touchLookState.deltaYaw, 0);
      assert.strictEqual(touchLookState.deltaPitch, 0);
    });

    test("resetAllTouchInput resets both movement and look simultaneously", () => {
      touchMovementState.x = -1;
      touchMovementState.y = 1;
      touchMovementState.sprint = true;
      touchLookState.deltaYaw = 0.12;
      touchLookState.deltaPitch = 0.08;

      resetAllTouchInput();

      assert.strictEqual(touchMovementState.x, 0);
      assert.strictEqual(touchMovementState.y, 0);
      assert.strictEqual(touchMovementState.sprint, false);
      assert.strictEqual(touchLookState.deltaYaw, 0);
      assert.strictEqual(touchLookState.deltaPitch, 0);
    });
  });

  // ============================================================================
  // 5. MULTI-TOUCH INDEPENDENCE
  // ============================================================================
  describe("Multi-Touch Channel Independence", () => {
    test("updating movement does not affect look state and vice-versa", () => {
      resetAllTouchInput();

      // Finger 1 engages movement
      touchMovementState.x = 0.6;
      touchMovementState.y = 0.8;

      assert.strictEqual(touchLookState.deltaYaw, 0);
      assert.strictEqual(touchLookState.deltaPitch, 0);

      // Finger 2 engages look
      touchLookState.deltaYaw = 0.04;
      touchLookState.deltaPitch = 0.02;

      assert.strictEqual(touchMovementState.x, 0.6);
      assert.strictEqual(touchMovementState.y, 0.8);

      // Releasing finger 1 resets movement without resetting look
      resetTouchMovementState();
      assert.strictEqual(touchMovementState.x, 0);
      assert.strictEqual(touchLookState.deltaYaw, 0.04);

      // Clean up
      resetAllTouchInput();
    });
  });

  // ============================================================================
  // 6. CAMERA PITCH LIMITS
  // ============================================================================
  describe("Camera Pitch Limits", () => {
    test("pitch within limits adjusts smoothly", () => {
      const pitch = clampPitch(0, 0.1, MAX_PITCH_ANGLE);
      assert.strictEqual(pitch, -0.1);
    });

    test("extreme upward drag is strictly clamped to +45 degrees", () => {
      // Trying to look up past 45 degrees
      const pitch = clampPitch(0.5, -0.8, MAX_PITCH_ANGLE);
      assert.ok(
        Math.abs(pitch - MAX_PITCH_ANGLE) < 1e-6,
        `Pitch should be clamped to ${MAX_PITCH_ANGLE}, got ${pitch}`
      );
    });

    test("extreme downward drag is strictly clamped to -45 degrees", () => {
      // Trying to look down past -45 degrees
      const pitch = clampPitch(-0.5, 0.8, MAX_PITCH_ANGLE);
      assert.ok(
        Math.abs(pitch - -MAX_PITCH_ANGLE) < 1e-6,
        `Pitch should be clamped to -${MAX_PITCH_ANGLE}, got ${pitch}`
      );
    });
  });

  // ============================================================================
  // 7. SPRINT VELOCITY SPEED RATIO
  // ============================================================================
  describe("Movement Velocity Consistency", () => {
    test("sprint velocity is ~1.66x faster than walk velocity", () => {
      assert.strictEqual(WALK_SPEED, 3.5);
      assert.strictEqual(SPRINT_SPEED, 5.8);
      const ratio = SPRINT_SPEED / WALK_SPEED;
      assert.ok(ratio > 1.65 && ratio < 1.67, `Speed ratio ${ratio} must be ~1.66`);
    });
  });

  // ============================================================================
  // 8. SSR SAFETY FOR FEATURE DETECTION
  // ============================================================================
  describe("Environment & Feature Detection Safety", () => {
    test("isTouchCapable and isFinePointerOnly execute safely without window (SSR)", () => {
      // Under Node.js test environment, window is undefined
      assert.strictEqual(typeof isTouchCapable(), "boolean");
      assert.strictEqual(typeof isFinePointerOnly(), "boolean");
    });
  });
});
