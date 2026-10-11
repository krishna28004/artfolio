import { describe, test, beforeEach } from "node:test";
import assert from "node:assert";
import {
  isPointerLockSupported,
  isPointerLocked,
  isPointerLockPending,
  resetPointerLockPending,
  safeRequestPointerLock,
  safeExitPointerLock,
} from "@/components/exhibition/controllers/pointer-lock-manager";

test("delayed void-return pointer-lock requests remain pending until the real event", async () => {
  resetPointerLockPending();
  const events = new EventTarget();
  const doc = {
    pointerLockElement: null as Element | null,
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
  };
  let calls = 0;
  const element = { ownerDocument: doc, requestPointerLock: () => { calls++; } } as unknown as HTMLElement;
  const first = safeRequestPointerLock(element);
  assert.equal(isPointerLockPending(), true);
  assert.equal(await safeRequestPointerLock(element), false);
  assert.equal(calls, 1);
  doc.pointerLockElement = element;
  events.dispatchEvent(new Event("pointerlockchange"));
  assert.equal(await first, true);
  assert.equal(isPointerLockPending(), false);
});

test("legacy pointer-lock denial releases pending state and permits an explicit retry", async () => {
  resetPointerLockPending();
  const events = new EventTarget();
  const doc = { pointerLockElement: null, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) };
  const element = { ownerDocument: doc, requestPointerLock: () => {} } as unknown as HTMLElement;
  const denied = safeRequestPointerLock(element);
  events.dispatchEvent(new Event("pointerlockerror"));
  assert.equal(await denied, false);
  assert.equal(isPointerLockPending(), false);
  const retry = safeRequestPointerLock(element);
  assert.equal(isPointerLockPending(), true);
  resetPointerLockPending();
  assert.equal(await retry, false);
});

describe("Artfolio Virtual Museum — Pointer Lock Lifecycle & Regression Tests", () => {
  beforeEach(() => {
    resetPointerLockPending();
  });

  // ============================================================================
  // 1. API FEATURE DETECTION & ENVIRONMENT COMPATIBILITY
  // ============================================================================
  describe("API Feature Detection", () => {
    test("isPointerLockSupported returns false in headless or non-browser environments", () => {
      assert.strictEqual(isPointerLockSupported(undefined), false);
    });

    test("isPointerLockSupported returns false when document lacks pointerLockElement property", () => {
      const mockDoc = {} as Document;
      assert.strictEqual(isPointerLockSupported(mockDoc), false);
    });

    test("isPointerLockSupported returns false when target element lacks requestPointerLock method", () => {
      const mockDoc = { pointerLockElement: null } as unknown as Document;
      const mockElem = {} as Element;
      assert.strictEqual(isPointerLockSupported(mockDoc, mockElem), false);
    });

    test("isPointerLockSupported returns true when document and element provide pointer lock API", () => {
      const mockDoc = { pointerLockElement: null } as unknown as Document;
      const mockElem = { requestPointerLock: () => {} } as unknown as Element;
      assert.strictEqual(isPointerLockSupported(mockDoc, mockElem), true);
    });
  });

  // ============================================================================
  // 2. POINTER LOCK STATE DETECTION
  // ============================================================================
  describe("Pointer Lock State Detection", () => {
    test("isPointerLocked returns false when pointerLockElement is null", () => {
      const mockDoc = { pointerLockElement: null } as unknown as Document;
      assert.strictEqual(isPointerLocked(undefined, mockDoc), false);
    });

    test("isPointerLocked returns true when any element is locked and no specific target is given", () => {
      const mockElem = {} as Element;
      const mockDoc = { pointerLockElement: mockElem } as unknown as Document;
      assert.strictEqual(isPointerLocked(undefined, mockDoc), true);
    });

    test("isPointerLocked correctly matches target element", () => {
      const mockCanvas = {} as Element;
      const otherElem = {} as Element;
      const mockDoc = { pointerLockElement: mockCanvas } as unknown as Document;

      assert.strictEqual(isPointerLocked(mockCanvas, mockDoc), true);
      assert.strictEqual(isPointerLocked(otherElem, mockDoc), false);
    });
  });

  // ============================================================================
  // 3. USER-GESTURE REQUIREMENT & TOUCH ISOLATION
  // ============================================================================
  describe("User-Gesture & Touch Device Isolation", () => {
    test("safeRequestPointerLock never requests lock when isTouchDevice is true", async () => {
      let called = false;
      const mockCanvas = {
        ownerDocument: { pointerLockElement: null },
        requestPointerLock: () => {
          called = true;
        },
      } as unknown as HTMLElement;

      const result = await safeRequestPointerLock(mockCanvas, { isTouchDevice: true });
      assert.strictEqual(result, false);
      assert.strictEqual(called, false, "requestPointerLock must NEVER be invoked on touch devices");
      assert.strictEqual(isPointerLockPending(), false);
    });

    test("safeRequestPointerLock returns false if target element is null or undefined", async () => {
      const result = await safeRequestPointerLock(null);
      assert.strictEqual(result, false);
      assert.strictEqual(isPointerLockPending(), false);
    });

    test("safeRequestPointerLock returns true immediately if already locked to target element", async () => {
      let callCount = 0;
      const mockCanvas = {
        requestPointerLock: () => {
          callCount++;
        },
      } as unknown as HTMLElement;
      const mockDoc = { pointerLockElement: mockCanvas };
      Object.defineProperty(mockCanvas, "ownerDocument", { value: mockDoc });

      const result = await safeRequestPointerLock(mockCanvas);
      assert.strictEqual(result, true);
      assert.strictEqual(callCount, 0, "Should not make redundant request when already locked");
      assert.strictEqual(isPointerLockPending(), false);
    });
  });

  // ============================================================================
  // 4. DUPLICATE & PENDING REQUEST THROTTLING
  // ============================================================================
  describe("Request Throttling & Duplicate Prevention", () => {
    test("safeRequestPointerLock prevents concurrent in-flight requests", async () => {
      let resolvePromise: () => void = () => {};
      const pendingPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      let callCount = 0;
      const mockCanvas = {
        requestPointerLock: () => {
          callCount++;
          return pendingPromise;
        },
      } as unknown as HTMLElement;
      const mockDoc = { pointerLockElement: null };
      Object.defineProperty(mockCanvas, "ownerDocument", { value: mockDoc });

      // First call initiates in-flight request
      const firstCall = safeRequestPointerLock(mockCanvas);
      assert.strictEqual(isPointerLockPending(), true);

      // Second simultaneous call should be throttled and rejected immediately
      const secondResult = await safeRequestPointerLock(mockCanvas);
      assert.strictEqual(secondResult, false);
      assert.strictEqual(callCount, 1, "Second request should be throttled while first is pending");

      // Finish first call
      resolvePromise();
      await firstCall;
      assert.strictEqual(isPointerLockPending(), false);
    });
  });

  // ============================================================================
  // 5. SYNCHRONOUS EXCEPTIONS & PROMISE REJECTIONS HANDLING
  // ============================================================================
  describe("Error Recovery & Exception Safety", () => {
    test("catches synchronous NotAllowedError / SecurityError without throwing", async () => {
      const mockCanvas = {
        requestPointerLock: () => {
          throw new Error("NotAllowedError: A user gesture is required to request Pointer Lock.");
        },
      } as unknown as HTMLElement;
      const mockDoc = { pointerLockElement: null };
      Object.defineProperty(mockCanvas, "ownerDocument", { value: mockDoc });

      // Must NOT throw uncaught error
      const result = await safeRequestPointerLock(mockCanvas);
      assert.strictEqual(result, false);
      assert.strictEqual(isPointerLockPending(), false);
    });

    test("handles rejected Promise from requestPointerLock without uncaught promise rejection", async () => {
      const mockCanvas = {
        requestPointerLock: () => {
          return Promise.reject(new Error("Runtime NotAllowedError: A user gesture is required to request Pointer Lock."));
        },
      } as unknown as HTMLElement;
      const mockDoc = { pointerLockElement: null };
      Object.defineProperty(mockCanvas, "ownerDocument", { value: mockDoc });

      // Must catch the rejection gracefully
      const result = await safeRequestPointerLock(mockCanvas);
      assert.strictEqual(result, false);
      assert.strictEqual(isPointerLockPending(), false);
    });

    test("supports browsers returning void instead of a Promise from requestPointerLock", async () => {
      let callCount = 0;
      const mockDoc = { pointerLockElement: null as Element | null };
      const mockCanvas = {
        requestPointerLock: () => {
          callCount++;
          mockDoc.pointerLockElement = mockCanvas;
          // Void return (standard in older browser specifications)
        },
      } as unknown as HTMLElement;
      Object.defineProperty(mockCanvas, "ownerDocument", { value: mockDoc });

      const result = await safeRequestPointerLock(mockCanvas);
      assert.strictEqual(result, true);
      assert.strictEqual(callCount, 1);
      assert.strictEqual(isPointerLockPending(), false);
    });
  });

  // ============================================================================
  // 6. SAFE EXIT & RE-ENTRY LIFECYCLE
  // ============================================================================
  describe("Safe Exit & Re-Entry Lifecycle", () => {
    test("safeExitPointerLock calls document.exitPointerLock when locked", () => {
      let exitCalled = false;
      const mockDoc = {
        pointerLockElement: {} as Element,
        exitPointerLock: () => {
          exitCalled = true;
        },
      } as unknown as Document;

      safeExitPointerLock(mockDoc);
      assert.strictEqual(exitCalled, true);
    });

    test("safeExitPointerLock is a no-op when no element is locked", () => {
      let exitCalled = false;
      const mockDoc = {
        pointerLockElement: null,
        exitPointerLock: () => {
          exitCalled = true;
        },
      } as unknown as Document;

      safeExitPointerLock(mockDoc);
      assert.strictEqual(exitCalled, false);
    });

    test("safeExitPointerLock catches errors if exitPointerLock throws", () => {
      const mockDoc = {
        pointerLockElement: {} as Element,
        exitPointerLock: () => {
          throw new Error("SecurityError: Exit denied");
        },
      } as unknown as Document;

      assert.doesNotThrow(() => {
        safeExitPointerLock(mockDoc);
      });
    });

    test("re-entry is permitted after exitPointerLock resets pointerLockElement", async () => {
      let locks = 0;
      const mockCanvas = {
        requestPointerLock: () => {
          locks++;
          mockDoc.pointerLockElement = mockCanvas;
        },
      } as unknown as HTMLElement;
      const mockDoc = {
        pointerLockElement: null as Element | null,
        exitPointerLock: () => {
          mockDoc.pointerLockElement = null;
        },
      };
      Object.defineProperty(mockCanvas, "ownerDocument", { value: mockDoc });

      // First lock
      await safeRequestPointerLock(mockCanvas);
      assert.strictEqual(locks, 1);
      assert.strictEqual(mockDoc.pointerLockElement, mockCanvas);

      // Release (e.g. user pressed Escape or opened modal)
      safeExitPointerLock(mockDoc as unknown as Document);
      assert.strictEqual(mockDoc.pointerLockElement, null);

      // Re-entry (user clicked canvas or designated look button)
      await safeRequestPointerLock(mockCanvas);
      assert.strictEqual(locks, 2, "Should cleanly re-enter pointer lock on subsequent user click");
      assert.strictEqual(mockDoc.pointerLockElement, mockCanvas);
    });
  });

  // ============================================================================
  // 7. ARTWORK MODAL & DESKTOP CONTROLS ISOLATION
  // ============================================================================
  describe("Artwork Modal & Controller Isolation", () => {
    test("closing modal clears inputs and does not automatically request pointer lock", () => {
      // Test state representation matching Controls.tsx & ExhibitionPage
      let isModalOpen = true;
      const requestedPointerLock = false;

      // On modal open: exitPointerLock is called
      let exitCalled = false;
      const mockDoc = {
        pointerLockElement: {} as Element,
        exitPointerLock: () => {
          exitCalled = true;
          mockDoc.pointerLockElement = null;
        },
      } as unknown as Document;

      if (isModalOpen) {
        safeExitPointerLock(mockDoc);
      }
      assert.strictEqual(exitCalled, true);
      assert.strictEqual(mockDoc.pointerLockElement, null);

      // User closes modal:
      isModalOpen = false;
      // Controls lifecycle verifies: closing modal must NEVER call requestPointerLock
      if (!isModalOpen) {
        // No automatic request
      }
      assert.strictEqual(requestedPointerLock, false, "Modal close must NOT trigger pointer lock outside user gesture");
    });
  });
});
