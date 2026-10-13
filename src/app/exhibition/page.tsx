"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader } from "@react-three/drei";
import { GalleryScene, GalleryArtwork } from "@/components/exhibition/GalleryScene";
import { ExhibitionErrorBoundary } from "@/components/exhibition/ExhibitionErrorBoundary";
import { ArtworkDetailModal } from "@/components/exhibition/ArtworkDetailModal";
import { MobileControls } from "@/components/exhibition/MobileControls";
import { Artwork } from "@/features/artwork/data/artworks";
import { isValid3DPosition } from "@/features/artwork/utils/exhibition-validation";
import { safeRequestPointerLock } from "@/components/exhibition/controllers/pointer-lock-manager";
import { isTouchCapable, isFinePointerOnly } from "@/components/exhibition/touch/touch-controller";

export default function ExhibitionPage() {
  const [entered, setEntered] = useState(false);
  const [showWalkHint, setShowWalkHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHUD, setShowHUD] = useState(false);
  const [dbArtworks, setDbArtworks] = useState<GalleryArtwork[] | undefined>(undefined);
  const [focusedArtwork, setFocusedArtwork] = useState<GalleryArtwork | null>(null);
  const [selectedArtworkModal, setSelectedArtworkModal] = useState<GalleryArtwork | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [useLegacyHall] = useState(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search).get("legacy") === "true";
    }
    return false;
  });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });

  // Listen for prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Fetch artwork data with robust 3D placement validation
  useEffect(() => {
    let isMounted = true;
    fetch("/api/artworks")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.success && Array.isArray(data.data)) {
          const formatted: GalleryArtwork[] = (data.data as Artwork[])
            .filter((a) => isValid3DPosition(a.position3D) && a.isAvailable !== false)
            .map((a) => ({
              id: a.id,
              title: a.title,
              artist: a.artist,
              year: a.year,
              medium: a.medium,
              dimensions: a.dimensions,
              url: a.textureUrl || a.imageUrl,
              position: a.position3D as [number, number, number],
              rotation: (a.rotation3D as [number, number, number]) || [0, 0, 0],
            }));
          if (formatted.length > 0) {
            setDbArtworks(formatted);
          }
        }
      })
      .catch((err) => {
        console.warn("[EXHIBITION_API] Using curated static exhibition catalog:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const triggerWalkHint = useCallback(() => {
    setShowWalkHint(true);
    const timer = setTimeout(() => setShowWalkHint(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  // Restore onboarded state from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (typeof window !== "undefined" && localStorage.getItem("artfolio_onboarded")) {
        setEntered(true);
        triggerWalkHint();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [triggerWalkHint]);

  const completeOnboarding = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("artfolio_onboarded", "true");
    }
    setEntered(true);
    triggerWalkHint();
  };

  // Sync fullscreen state
  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      setIsFullscreen(!!(document.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      const doc = document as Document & {
        webkitFullscreenElement?: Element;
        webkitExitFullscreen?: () => Promise<void>;
      };
      const elem = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };

      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        }
      } else {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed:", err);
    }
  };

  // Keyboard shortcut: Press 'E', 'V', or 'Enter' to open artwork inspection modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedArtworkModal) return; // Modal manages its own keys (like Escape)
      if (
        (e.code === "KeyE" ||
          e.code === "KeyV" ||
          e.key === "e" ||
          e.key === "E" ||
          e.key === "v" ||
          e.key === "V" ||
          e.code === "Enter") &&
        focusedArtwork &&
        entered
      ) {
        e.preventDefault();
        setSelectedArtworkModal(focusedArtwork);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusedArtwork, entered, selectedArtworkModal]);

  // Dismiss walk hint on interaction
  useEffect(() => {
    if (!showWalkHint) return;
    const dismiss = () => setShowWalkHint(false);
    window.addEventListener("dblclick", dismiss);
    window.addEventListener("keydown", dismiss);
    window.addEventListener("pointerdown", dismiss);
    return () => {
      window.removeEventListener("dblclick", dismiss);
      window.removeEventListener("keydown", dismiss);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, [showWalkHint]);

  // Designated desktop mouse-look entry via trusted user gesture
  const enterMouseLook = useCallback(() => {
    if (selectedArtworkModal) return;
    const canvas = document.querySelector("canvas");
    if (canvas) {
      safeRequestPointerLock(canvas, {
        isTouchDevice: isTouchCapable() && !isFinePointerOnly(),
      }).catch(() => {});
    }
  }, [selectedArtworkModal]);

  return (
    <div className="fixed inset-0 w-full h-[100dvh] overflow-hidden bg-[#0d0d0d] select-none">
      {/* Drei Loader — Outside Canvas with luxury styling */}
      <Loader
        containerStyles={{
          background: "#080808",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 50,
        }}
        innerStyles={{
          width: "240px",
          height: "1px",
          background: "rgba(255,255,255,0.05)",
          overflow: "hidden",
        }}
        barStyles={{
          background: "linear-gradient(90deg, #d4af37, #f2ca50)",
          height: "1px",
          boxShadow: "0 0 20px rgba(212, 175, 55, 0.4)",
        }}
        dataInterpolation={(p) => `ARCHIVING SPATIAL MATRIX · ${p.toFixed(0)}%`}
        dataStyles={{
          fontFamily: "var(--font-serif)",
          fontSize: "11px",
          color: "#f2ca50",
          letterSpacing: "0.4em",
          textTransform: "uppercase",
          marginTop: "24px",
          fontWeight: "300",
          opacity: "0.8",
        }}
      />

      {/* R3F Canvas with WebGL Error Boundary */}
      <ExhibitionErrorBoundary>
        <GalleryScene
          artworks={dbArtworks}
          onFocusArtwork={setFocusedArtwork}
          onSelectArtwork={setSelectedArtworkModal}
          isModalOpen={!!selectedArtworkModal}
          useLegacyHall={useLegacyHall}
          prefersReducedMotion={prefersReducedMotion}
          onPointerLockChange={setIsPointerLocked}
        />
      </ExhibitionErrorBoundary>

      {/* ========== HUD (shown after entering) ========== */}
      {entered && (
        <>
          {/* Top Bar with safe-area padding */}
          <div className="absolute top-0 left-0 w-full z-20 p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] flex justify-between items-start pointer-events-none">
            <div>
              <p className="font-serif text-primary text-xl tracking-[0.1em]">
                Digital Exhibition
              </p>
              <p className="font-sans text-muted text-[10px] tracking-[0.15em] uppercase mt-1 opacity-70">
                Walk freely · Explore the artworks
              </p>
              <Link
                href="/exhibition/accessible"
                className="pointer-events-auto inline-block mt-2 text-[10px] uppercase tracking-widest text-primary/80 hover:text-white border-b border-primary/40 pb-0.5 transition-colors focus:ring-1 focus:ring-primary focus:outline-none"
              >
                Accessible 2D Exhibition &rarr;
              </Link>

              <button
                onClick={() => setShowHUD(!showHUD)}
                className="pointer-events-auto mt-4 px-3.5 py-1.5 font-sans text-[10px] uppercase tracking-widest text-[#a0a0a0] border border-white/10 bg-black/60 rounded-md hover:bg-white/10 active:scale-95 transition-all"
              >
                {showHUD ? "Hide Touch Controls" : "Touch Controls"}
              </button>
            </div>

            <div className="flex gap-4 items-center pointer-events-auto">
              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="w-11 h-11 flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors border border-white/10 hover:border-white/30 bg-black/60 backdrop-blur-sm rounded-md focus:ring-1 focus:ring-primary focus:outline-none"
                aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                  </svg>
                ) : (
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                  </svg>
                )}
              </button>

              {/* Exit Application */}
              <Link
                href="/"
                className="font-sans text-[10px] uppercase tracking-widest text-[#a0a0a0] hover:text-white transition-colors border border-white/10 hover:border-white/30 bg-black/60 backdrop-blur-sm px-5 py-3 rounded-md flex items-center justify-center focus:ring-1 focus:ring-primary focus:outline-none"
              >
                Exit
              </Link>
            </div>
          </div>

          {/* Reduced Motion Suggestion Banner */}
          {prefersReducedMotion && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-auto bg-black/80 backdrop-blur-md border border-primary/30 px-5 py-2.5 rounded-full flex items-center gap-4 text-xs">
              <span className="text-white/80 font-sans text-[11px]">
                Reduced motion is active. Would you prefer our 2D archival catalog?
              </span>
              <Link
                href="/exhibition/accessible"
                className="text-primary font-bold text-[11px] uppercase tracking-wider hover:underline"
              >
                Open 2D Catalog &rarr;
              </Link>
            </div>
          )}

          {/* Crosshair */}
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-white/40 ring-1 ring-white/20"></div>
          </div>

          {/* Walk Hint Popup */}
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-12 z-40 pointer-events-none transition-all duration-1000 ${
              showWalkHint ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <div className="bg-black/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full flex items-center justify-center gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              <p className="font-sans text-[11px] uppercase tracking-[0.15em] text-white/90 whitespace-nowrap">
                Point at floor &amp; double-click (or tap) to walk
              </p>
            </div>
          </div>

          {/* Focused Artwork Proximity Card */}
          {focusedArtwork && !selectedArtworkModal && (
            <div className="absolute bottom-[max(5.5rem,env(safe-area-inset-bottom))] left-4 right-4 sm:left-auto sm:right-8 sm:bottom-8 z-30 sm:max-w-sm p-4 sm:p-5 bg-black/85 backdrop-blur-md border border-primary/40 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-3 pointer-events-auto">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="text-[9px] uppercase tracking-[0.25em] text-primary font-semibold block mb-1">
                    Artwork in Focus
                  </span>
                  <h3 className="font-serif text-white text-base font-normal tracking-wide">
                    {focusedArtwork.title || "Fine Art Piece"}
                  </h3>
                  <p className="font-sans text-[11px] text-white/70 mt-0.5">
                    {focusedArtwork.artist || "Krishna Kumar"}
                    {focusedArtwork.year ? ` · ${focusedArtwork.year}` : ""}
                  </p>
                  <p className="font-sans text-[10px] text-white/50 mt-1">
                    {focusedArtwork.medium || "Pencil on Paper"}
                    {focusedArtwork.dimensions ? ` · ${focusedArtwork.dimensions}` : ""}
                  </p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedArtworkModal(focusedArtwork)}
                  className="px-4 py-2 bg-primary text-[#1a0f00] font-sans text-[10px] uppercase tracking-widest font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_0_12px_rgba(242,202,80,0.2)] focus:ring-1 focus:ring-primary focus:outline-none min-h-[40px]"
                >
                  Inspect Artwork
                </button>
                <div className="flex items-center gap-2">
                  <span className="hidden sm:inline font-mono text-[9px] text-white/50 border border-white/15 px-1.5 py-0.5 rounded">
                    [E]
                  </span>
                  <Link
                    href={`/artwork/${focusedArtwork.id}`}
                    className="text-[10px] uppercase tracking-widest text-white/60 hover:text-white transition-colors ml-1 p-2 min-h-[40px] flex items-center"
                  >
                    Dossier &rarr;
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* ========== MOBILE & TABLET TOUCH CONTROLS (Phase 4A) ========== */}
          <MobileControls
            isModalOpen={!!selectedArtworkModal}
            onInspectArtwork={() => {
              if (focusedArtwork) setSelectedArtworkModal(focusedArtwork);
            }}
            hasArtworkInFocus={!!focusedArtwork}
            forceShowControls={showHUD}
          />

          {/* Desktop Navigation Hints & Explicit Look Control */}
          {!selectedArtworkModal && !showHUD && (
            <div className="absolute bottom-8 right-8 z-30 hidden md:flex flex-col items-end gap-2">
              {!isPointerLocked ? (
                <button
                  type="button"
                  onClick={enterMouseLook}
                  className="pointer-events-auto px-4 py-2 font-sans text-[11px] uppercase tracking-widest text-[#d4af37] border border-[#d4af37]/50 bg-black/80 backdrop-blur-md rounded-lg hover:bg-[#d4af37]/15 hover:border-[#f2ca50] active:scale-95 transition-all shadow-[0_0_15px_rgba(212,175,55,0.25)] flex items-center gap-2 group cursor-pointer focus:ring-1 focus:ring-primary focus:outline-none"
                  aria-label="Click to look around with mouse"
                >
                  <span className="w-2 h-2 rounded-full bg-[#f2ca50] animate-pulse group-hover:scale-125 transition-transform" />
                  <span>Click to look around</span>
                  <span className="font-mono text-[9px] text-white/50 border border-white/20 px-1 py-0.5 rounded">
                    ESC to exit
                  </span>
                </button>
              ) : (
                <div className="font-mono text-[10px] text-white/70 tracking-wider bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded border border-white/10 pointer-events-none">
                  Mouse Look active · Press <span className="text-[#f2ca50]">ESC</span> to release cursor
                </div>
              )}
              <div className="font-mono text-[10px] text-white/50 tracking-wider pointer-events-none">
                WASD / Arrows to Walk · Shift to Sprint
              </div>
            </div>
          )}
        </>
      )}

      {/* ========== ENTRY OVERLAY ========== */}
      {!entered && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-6">
          <h1 className="font-serif text-3xl md:text-5xl text-white tracking-tight mb-8 text-center">
            Virtual Gallery Exhibition
          </h1>

          <div className="flex flex-col gap-5 text-center max-w-sm mb-10 bg-white/5 border border-white/10 p-6 sm:p-8 rounded-xl shadow-2xl">
            <div>
              <div className="font-sans text-[10px] text-muted tracking-widest uppercase mb-1">
                Desktop Controls
              </div>
              <div className="font-mono text-white text-[12px] sm:text-[13px] leading-relaxed">
                Click gallery to look around · WASD / Arrows to walk · Double-click floor
              </div>
            </div>
            <div className="w-12 h-[1px] bg-white/10 mx-auto"></div>
            <div>
              <div className="font-sans text-[10px] text-muted tracking-widest uppercase mb-1">
                Mobile &amp; Tablet
              </div>
              <div className="font-mono text-white text-[12px] sm:text-[13px] leading-relaxed">
                Left joystick to walk · Right drag to look · Tap floor or artwork to interact
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-[env(safe-area-inset-bottom)]">
            <button
              onClick={completeOnboarding}
              className="px-8 py-3.5 bg-primary text-[#1a0f00] font-sans uppercase tracking-[0.15em] text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(242,202,80,0.15)] min-h-[44px]"
            >
              Enter Exhibition
            </button>
            <Link
              href="/exhibition/accessible"
              className="px-8 py-3.5 bg-transparent text-white/70 font-sans uppercase tracking-[0.15em] text-[11px] hover:text-white border border-white/20 active:scale-95 hover:bg-white/5 transition-all text-center flex items-center justify-center min-h-[44px]"
            >
              Accessible 2D Archive &rarr;
            </Link>
          </div>
        </div>
      )}

      {/* ========== ARTWORK DETAIL MODAL (Phase 3) ========== */}
      <ArtworkDetailModal
        artwork={selectedArtworkModal}
        isOpen={!!selectedArtworkModal}
        onClose={() => setSelectedArtworkModal(null)}
        prefersReducedMotion={prefersReducedMotion}
      />
    </div>
  );
}
