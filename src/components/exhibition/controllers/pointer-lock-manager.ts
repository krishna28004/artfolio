/**
 * Artfolio Virtual Museum — Robust Pointer Lock Lifecycle Manager
 * 
 * Provides safe, user-gesture compliant pointer-lock operations with:
 * - Feature detection (detects unsupported browsers & headless environments)
 * - Touch-device prevention (never forces pointer-lock on touch/coarse devices)
 * - Safe exception & Promise rejection handling (catches NotAllowedError)
 * - Prevention of duplicate or pending requests
 * - Clean document event listening and graceful error recovery
 */

export interface PointerLockOptions {
  isTouchDevice?: boolean;
  unadjustedMovement?: boolean;
}

/**
 * Checks whether the Pointer Lock API is supported in the current environment.
 */
export function isPointerLockSupported(doc?: Document, target?: Element): boolean {
  const d = doc || (typeof document !== "undefined" ? document : undefined);
  if (!d) return false;
  const hasDoc = "pointerLockElement" in d;
  const hasElem = target
    ? typeof target.requestPointerLock === "function"
    : typeof Element !== "undefined" && typeof Element.prototype.requestPointerLock === "function";
  return hasDoc && hasElem;
}

/**
 * Checks whether a specific element (or any element) currently holds pointer lock.
 */
export function isPointerLocked(targetElement?: Element | null, doc?: Document): boolean {
  const d = doc || (typeof document !== "undefined" ? document : undefined);
  if (!d || !d.pointerLockElement) return false;
  if (!targetElement) return true;
  return d.pointerLockElement === targetElement;
}

// Track whether a pointer-lock request is currently in-flight to prevent duplicate requests
let isRequestPending = false;
let finishPending: (() => void) | null = null;

export function isPointerLockPending(): boolean {
  return isRequestPending;
}

export function resetPointerLockPending(): void {
  finishPending?.();
  isRequestPending = false;
}

/**
 * Safely requests pointer lock on a target element in response to a user gesture.
 * Catches synchronous errors and handles Promise rejection without throwing
 * uncaught runtime errors into Next.js or the browser console.
 * 
 * Returns a promise resolving to true if locked, or false if denied/unsupported.
 */
export async function safeRequestPointerLock(
  targetElement: HTMLElement | Element | null | undefined,
  options?: PointerLockOptions
): Promise<boolean> {
  // Never request pointer lock on touch/mobile devices
  if (options?.isTouchDevice) {
    return false;
  }

  if (!targetElement) {
    return false;
  }

  const doc = targetElement.ownerDocument || (typeof document !== "undefined" ? document : null);
  if (!doc || !isPointerLockSupported(doc, targetElement)) {
    return false;
  }

  // Already locked to this element
  if (doc.pointerLockElement === targetElement) {
    return true;
  }

  // Do not spam concurrent requests
  if (isRequestPending) {
    return false;
  }

  isRequestPending = true;
  let finish = () => {};
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const canListen = typeof doc.addEventListener === "function";
  const completion = new Promise<boolean>((resolve) => {
    finish = () => {
      if (timeout) clearTimeout(timeout);
      if (canListen) {
        doc.removeEventListener("pointerlockchange", finish);
        doc.removeEventListener("pointerlockerror", finish);
      }
      if (finishPending === finish) {
        finishPending = null;
        isRequestPending = false;
      }
      resolve(doc.pointerLockElement === targetElement);
    };
  });
  finishPending = finish;
  if (canListen) {
    doc.addEventListener("pointerlockchange", finish);
    doc.addEventListener("pointerlockerror", finish);
  }

  try {
    const requestOptions = options?.unadjustedMovement
      ? { unadjustedMovement: true }
      : undefined;

    // Call requestPointerLock - may return void or a Promise depending on browser version
    const maybePromise = targetElement.requestPointerLock(requestOptions);

    if (maybePromise && typeof (maybePromise as Promise<void>).then === "function") {
      await (maybePromise as Promise<void>).catch((err: unknown) => {
        // Gracefully catch NotAllowedError / SecurityError without throwing
        if (process.env.NODE_ENV !== "production") {
          const msg = err instanceof Error ? err.message : String(err);
          // Only log debug info in dev without triggering fatal overlay
          if (!msg.includes("user gesture")) {
            console.debug("[POINTER_LOCK_DENIED]", msg);
          }
        }
      });
    } else if (canListen && doc.pointerLockElement !== targetElement) {
      // Legacy APIs return void before the asynchronous lock/error event arrives.
      timeout = setTimeout(finish, 2000);
      return await completion;
    }

    return doc.pointerLockElement === targetElement;
  } catch (err) {
    // Catch synchronous errors in older browsers or unsupported contexts
    if (process.env.NODE_ENV !== "production") {
      console.debug("[POINTER_LOCK_ERROR]", err);
    }
    return false;
  } finally {
    finish();
  }
}

/**
 * Safely exits pointer lock if currently active.
 */
export function safeExitPointerLock(doc?: Document): void {
  const d = doc || (typeof document !== "undefined" ? document : null);
  if (!d || !d.pointerLockElement) return;

  try {
    const res: unknown = d.exitPointerLock?.();
    if (res && typeof (res as Promise<void>).catch === "function") {
      (res as Promise<void>).catch(() => {});
    }
  } catch (err) {
    // Ignore exit errors
    if (process.env.NODE_ENV !== "production") {
      console.debug("[POINTER_LOCK_EXIT_ERROR]", err);
    }
  }
}
