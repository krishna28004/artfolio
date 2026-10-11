"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  computeJoystickInput,
  touchMovementState,
  touchLookState,
  resetAllTouchInput,
  isTouchCapable,
  isFinePointerOnly,
  DEFAULT_JOYSTICK_RADIUS,
  DEFAULT_DEADZONE,
} from "./touch/touch-controller";

export interface MobileControlsProps {
  isModalOpen?: boolean;
  onInspectArtwork?: () => void;
  hasArtworkInFocus?: boolean;
  forceShowControls?: boolean;
}

export function MobileControls({
  isModalOpen = false,
  onInspectArtwork,
  hasArtworkInFocus = false,
  forceShowControls = false,
}: MobileControlsProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [isJoystickEngaged, setIsJoystickEngaged] = useState(false);
  const [previousModalOpen, setPreviousModalOpen] = useState(isModalOpen);
  // Reset rendered flags on a modal transition; input refs are reset by the effect below.
  if (previousModalOpen !== isModalOpen) {
    setPreviousModalOpen(isModalOpen);
    setIsSprinting(false);
    setIsJoystickEngaged(false);
  }

  // Joystick DOM and pointer refs
  const joystickBaseRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const joystickPointerIdRef = useRef<number | null>(null);
  const joystickCenterRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch-look DOM and pointer refs
  const lookPointerIdRef = useRef<number | null>(null);
  const lastLookPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Feature detection for touch input
  useEffect(() => {
    const detectTouch = () => {
      const capable = isTouchCapable() && !isFinePointerOnly();
      setIsTouchDevice(capable);
    };

    detectTouch();

    const handleFirstTouch = () => {
      setIsTouchDevice(true);
      window.removeEventListener("touchstart", handleFirstTouch);
    };

    window.addEventListener("touchstart", handleFirstTouch, { passive: true, once: true });
    return () => {
      window.removeEventListener("touchstart", handleFirstTouch);
    };
  }, []);

  // Sync sprint state to touchMovementState
  useEffect(() => {
    touchMovementState.sprint = isSprinting;
  }, [isSprinting]);

  // Clean reset function
  const resetJoystick = useCallback(() => {
    joystickPointerIdRef.current = null;
    setIsJoystickEngaged(false);
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = "translate3d(0px, 0px, 0px)";
    }
    touchMovementState.x = 0;
    touchMovementState.y = 0;
  }, []);

  const resetLook = useCallback(() => {
    lookPointerIdRef.current = null;
    touchLookState.deltaYaw = 0;
    touchLookState.deltaPitch = 0;
  }, []);

  // Reset inputs when modal opens
  useEffect(() => {
    if (isModalOpen) {
      joystickPointerIdRef.current = null;
      lookPointerIdRef.current = null;
      resetAllTouchInput();
    }
  }, [isModalOpen]);

  useEffect(() => {
    const handleBlur = () => {
      resetJoystick();
      resetLook();
      setIsSprinting(false);
      resetAllTouchInput();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        resetJoystick();
        resetLook();
        setIsSprinting(false);
        resetAllTouchInput();
      }
    };

    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resetAllTouchInput();
    };
  }, [resetJoystick, resetLook]);

  // --- JOYSTICK POINTER HANDLERS ---
  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isModalOpen || joystickPointerIdRef.current !== null) return;

    e.preventDefault();
    e.stopPropagation();

    joystickPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsJoystickEngaged(true);
    setHasInteracted(true);

    if (joystickBaseRef.current) {
      const rect = joystickBaseRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      joystickCenterRef.current = { x: centerX, y: centerY };

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const calc = computeJoystickInput(dx, dy, DEFAULT_JOYSTICK_RADIUS, DEFAULT_DEADZONE);

      if (joystickKnobRef.current) {
        joystickKnobRef.current.style.transform = `translate3d(${calc.knobX}px, ${calc.knobY}px, 0px)`;
      }
      touchMovementState.x = calc.x;
      touchMovementState.y = calc.y;
    }
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joystickPointerIdRef.current || isModalOpen) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - joystickCenterRef.current.x;
    const dy = e.clientY - joystickCenterRef.current.y;
    const calc = computeJoystickInput(dx, dy, DEFAULT_JOYSTICK_RADIUS, DEFAULT_DEADZONE);

    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = `translate3d(${calc.knobX}px, ${calc.knobY}px, 0px)`;
    }
    touchMovementState.x = calc.x;
    touchMovementState.y = calc.y;
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joystickPointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture already lost
    }
    resetJoystick();
  };

  const handleJoystickPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== joystickPointerIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if capture already lost
    }
    resetJoystick();
  };

  // --- TOUCH-LOOK POINTER HANDLERS ---
  const handleLookPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isModalOpen || lookPointerIdRef.current !== null) return;

    // Do not capture if pointer originated on joystick
    if (e.pointerId === joystickPointerIdRef.current) return;

    e.preventDefault();
    e.stopPropagation();

    lookPointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
    setHasInteracted(true);
  };

  const handleLookPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerIdRef.current || isModalOpen) return;

    e.preventDefault();
    e.stopPropagation();

    const dx = e.clientX - lastLookPosRef.current.x;
    const dy = e.clientY - lastLookPosRef.current.y;

    // Smooth configurable touch-look sensitivity
    const sensX = 0.0035;
    const sensY = 0.0035;

    touchLookState.deltaYaw += dx * sensX;
    touchLookState.deltaPitch += dy * sensY;

    lastLookPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    resetLook();
  };

  const handleLookPointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerIdRef.current) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }
    resetLook();
  };

  // Only render on touch-capable devices or when forced
  if (!isTouchDevice && !forceShowControls) {
    return null;
  }

  // When modal is open, completely suppress touch overlays
  if (isModalOpen) {
    return null;
  }

  return (
    <>
      {/* ============================================================== */}
      {/* 1. RIGHT-SIDE TOUCH-LOOK ZONE                                 */}
      {/* Dedicated area covering the right half of the screen.         */}
      {/* Ignores top header and bottom card areas.                     */}
      {/* ============================================================== */}
      <div
        className="fixed top-24 bottom-24 right-0 w-[48vw] md:w-[42vw] z-20 touch-none select-none pointer-events-auto"
        onPointerDown={handleLookPointerDown}
        onPointerMove={handleLookPointerMove}
        onPointerUp={handleLookPointerUp}
        onPointerCancel={handleLookPointerCancel}
        onLostPointerCapture={resetLook}
        aria-hidden="true"
      >
        {/* Subtle, non-intrusive instruction cue that fades on interaction */}
        {!hasInteracted && (
          <div className="absolute top-1/2 right-6 -translate-y-1/2 flex items-center gap-2 pointer-events-none opacity-60 animate-pulse transition-opacity duration-700">
            <span
              style={{ borderRadius: "9999px" }}
              className="font-sans text-[10px] uppercase tracking-widest text-white/70 bg-black/60 backdrop-blur-md px-3.5 py-1.5 border border-white/10"
            >
              Drag to Look &rarr;
            </span>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* 2. LOWER-LEFT MOVEMENT JOYSTICK CONTAINER                     */}
      {/* Safe-area inset aware, premium glassmorphism styling.         */}
      {/* ============================================================== */}
      <div className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[max(1.5rem,env(safe-area-inset-left))] z-30 flex flex-col landscape:flex-row items-center landscape:items-end gap-2.5 select-none pointer-events-auto">
        {/* Virtual Joystick Assembly */}
        <div className="flex flex-col items-center gap-1">
          {/* Virtual Joystick Disc */}
          <div
            ref={joystickBaseRef}
            style={{ borderRadius: "50%" }}
            onPointerDown={handleJoystickPointerDown}
            onPointerMove={handleJoystickPointerMove}
            onPointerUp={handleJoystickPointerUp}
            onPointerCancel={handleJoystickPointerCancel}
            onLostPointerCapture={resetJoystick}
            className={`relative w-[112px] h-[112px] sm:w-[124px] sm:h-[124px] flex items-center justify-center touch-none transition-shadow duration-300 border backdrop-blur-md ${
              isJoystickEngaged
                ? "bg-black/65 border-[#d4af37]/60 shadow-[0_0_24px_rgba(212,175,55,0.25)] ring-1 ring-[#d4af37]/40"
                : "bg-black/50 border-white/15 shadow-xl hover:border-white/30"
            }`}
            aria-label="Movement Virtual Joystick"
            role="group"
          >
            {/* Subtle Directional Crosshairs */}
            <div className="absolute inset-x-0 h-[1px] bg-white/5 pointer-events-none" />
            <div className="absolute inset-y-0 w-[1px] bg-white/5 pointer-events-none" />

            {/* Central Neutral Marker */}
            <div
              style={{ borderRadius: "50%" }}
              className="w-2.5 h-2.5 bg-white/20 pointer-events-none"
            />

            {/* Draggable Knob Thumb */}
            <div
              ref={joystickKnobRef}
              style={{ borderRadius: "50%" }}
              className={`absolute w-12 h-12 sm:w-14 sm:h-14 pointer-events-none transition-transform will-change-transform shadow-2xl flex items-center justify-center border ${
                isJoystickEngaged
                  ? "bg-gradient-to-br from-[#d4af37]/40 to-black/70 border-[#f2ca50] shadow-[0_0_15px_rgba(242,202,80,0.4)]"
                  : "bg-gradient-to-br from-white/25 to-black/60 border-white/30"
              }`}
            >
              <div
                style={{ borderRadius: "50%" }}
                className="w-3.5 h-3.5 bg-white/80 shadow-sm"
              />
            </div>
          </div>

          {/* Joystick Label */}
          <span className="font-sans text-[8px] uppercase tracking-[0.2em] text-white/40 pointer-events-none">
            Move
          </span>
        </div>

        {/* Sprint Toggle Pill */}
        <button
          type="button"
          onClick={() => setIsSprinting((prev) => !prev)}
          style={{ borderRadius: "9999px" }}
          className={`px-3 py-1.5 font-mono text-[9px] uppercase tracking-wider transition-all backdrop-blur-md flex items-center gap-1.5 border shadow-lg ${
            isSprinting
              ? "bg-[#d4af37]/20 border-[#d4af37] text-[#f2ca50] shadow-[0_0_12px_rgba(212,175,55,0.3)]"
              : "bg-black/60 border-white/15 text-white/70 hover:text-white"
          }`}
          aria-label={isSprinting ? "Disable Sprint Mode" : "Enable Sprint Mode"}
          title={isSprinting ? "Sprint Active (5.8 m/s)" : "Normal Walking (3.5 m/s)"}
        >
          <span
            style={{ borderRadius: "50%" }}
            className={`w-1.5 h-1.5 ${
              isSprinting ? "bg-[#f2ca50] animate-ping" : "bg-white/40"
            }`}
          />
          {isSprinting ? "SPRINT ON" : "SPRINT"}
        </button>
      </div>

      {/* ============================================================== */}
      {/* 3. MOBILE ACTION BUTTON FOR FOCUSED ARTWORK                    */}
      {/* Large, comfortable tap target when standing near an artwork.   */}
      {/* ============================================================== */}
      {hasArtworkInFocus && onInspectArtwork && (
        <div className="fixed bottom-[max(2rem,env(safe-area-inset-bottom))] right-[max(1.5rem,env(safe-area-inset-right))] z-30 pointer-events-auto md:hidden">
          <button
            type="button"
            onClick={onInspectArtwork}
            className="px-5 py-3.5 bg-primary text-[#1a0f00] font-sans font-bold text-xs uppercase tracking-widest rounded-xl shadow-[0_0_24px_rgba(242,202,80,0.35)] active:scale-95 transition-all flex items-center gap-2 border border-[#f2ca50]/50"
            aria-label="Inspect Focused Artwork"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span>Inspect</span>
          </button>
        </div>
      )}
    </>
  );
}
