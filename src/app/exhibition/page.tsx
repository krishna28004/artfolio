"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader } from "@react-three/drei";
import { GalleryScene } from "@/components/exhibition/GalleryScene";
import { movementState } from "@/components/exhibition/Controls";

/* Helper: set a movement direction on/off */
function press(dir: "forward" | "backward" | "left" | "right") {
    movementState[dir] = true;
}
function release(dir: "forward" | "backward" | "left" | "right") {
    movementState[dir] = false;
}

export default function ExhibitionPage() {
    const [entered, setEntered] = useState(false);
    const [showWalkHint, setShowWalkHint] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showHUD, setShowHUD] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            if (localStorage.getItem("artfolio_onboarded")) {
                setEntered(true);
            }
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const completeOnboarding = () => {
        localStorage.setItem("artfolio_onboarded", "true");
        setEntered(true);
    };

    // Sync fullscreen state if changed by external means (like Esc key)
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
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
            if (!document.fullscreenElement && !(document as any).webkitFullscreenElement) {
                const elem = document.documentElement as any;
                if (elem.requestFullscreen) {
                    await elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    await elem.webkitRequestFullscreen();
                }
            } else {
                const doc = document as any;
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

    // Fade in walk hint after entry, fade out after 6 seconds
    useEffect(() => {
        if (entered) {
            setShowWalkHint(true);
            const timer = setTimeout(() => {
                setShowWalkHint(false);
            }, 6000);
            return () => clearTimeout(timer);
        }
    }, [entered]);

    // Fast-vanish walk hint if they start interacting
    useEffect(() => {
        if (!showWalkHint) return;
        const dismiss = () => setShowWalkHint(false);
        // Bind to common walking triggers so the tip instantly hides when they "get it"
        window.addEventListener("dblclick", dismiss);
        window.addEventListener("keydown", dismiss);
        window.addEventListener("pointerdown", dismiss);
        return () => {
            window.removeEventListener("dblclick", dismiss);
            window.removeEventListener("keydown", dismiss);
            window.removeEventListener("pointerdown", dismiss);
        };
    }, [showWalkHint]);

    return (
        <div className="relative w-screen h-screen overflow-hidden bg-[#0d0d0d] select-none">

            {/* Drei Loader — Safely OUTSIDE Canvas with refined luxury styling */}
            <Loader
                containerStyles={{
                    background: "#080808",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center"
                }}
                innerStyles={{
                    width: "240px",
                    height: "1px",
                    background: "rgba(255,255,255,0.05)",
                    overflow: "hidden"
                }}
                barStyles={{
                    background: "linear-gradient(90deg, #d4af37, #f2ca50)",
                    height: "1px",
                    boxShadow: "0 0 20px rgba(212, 175, 55, 0.4)"
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
                    opacity: "0.8"
                }}
            />

            {/* R3F Canvas */}
            <GalleryScene />

            {/* ========== HUD (shown after entering) ========== */}
            {entered && (
                <>
                    {/* Top Bar with safe-area padding for notch devices */}
                    <div className="absolute top-0 left-0 w-full z-20 p-6 pt-[max(1.5rem,env(safe-area-inset-top))] pl-[max(1.5rem,env(safe-area-inset-left))] pr-[max(1.5rem,env(safe-area-inset-right))] flex justify-between items-start pointer-events-none">
                        <div>
                            <p className="font-serif text-primary text-xl tracking-[0.1em]">Digital Exhibition</p>
                            <p className="font-sans text-muted text-[10px] tracking-[0.15em] uppercase mt-1 opacity-70">
                                Walk freely · Explore the artworks
                            </p>
                            <button onClick={() => setShowHUD(!showHUD)} className="pointer-events-auto mt-4 px-4 py-2 font-sans text-[10px] uppercase tracking-widest text-[#a0a0a0] border border-white/10 bg-black/60 rounded-md md:hidden hover:bg-white/10 active:scale-95 transition-all">
                                {showHUD ? "Hide Controls" : "Show Controls"}
                            </button>
                        </div>
                        <div className="flex gap-4 items-center pointer-events-auto">
                            {/* Fullscreen Toggle */}
                            <button
                                onClick={toggleFullscreen}
                                className="w-11 h-11 flex items-center justify-center text-[#a0a0a0] hover:text-white transition-colors border border-white/10 hover:border-white/30 bg-black/60 backdrop-blur-sm rounded-md"
                                aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                            >
                                {isFullscreen ? (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
                                    </svg>
                                ) : (
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                                    </svg>
                                )}
                            </button>
                            {/* Exit Application */}
                            <Link
                                href="/"
                                className="font-sans text-[10px] uppercase tracking-widest text-[#a0a0a0] hover:text-white transition-colors border border-white/10 hover:border-white/30 bg-black/60 backdrop-blur-sm px-5 py-3 rounded-md flex items-center justify-center"
                            >
                                Exit
                            </Link>
                        </div>
                    </div>

                    {/* Crosshair */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
                        <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
                    </div>

                    {/* Walk Hint Popup */}
                    <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-12 z-40 pointer-events-none transition-all duration-1000 ${showWalkHint ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                        <div className="bg-black/60 backdrop-blur-md border border-white/10 px-6 py-3 rounded-full flex items-center justify-center gap-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            <p className="font-sans text-[11px] uppercase tracking-[0.15em] text-white/90 whitespace-nowrap">
                                Navigate pointer to floor &amp; double-click to move
                            </p>
                        </div>
                    </div>

                    {/* ========== ON-SCREEN NAVIGATION BUTTONS ========== */}
                    {showHUD && (
                        <div className="absolute bottom-8 left-8 z-30 flex flex-col items-center gap-2 md:hidden animate-in fade-in slide-in-from-bottom-4">
                            {/* Forward */}
                            <button
                                className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg touch-none"
                                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press("forward"); }}
                                onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); release("forward"); }}
                                onPointerLeave={() => release("forward")}
                                onPointerCancel={() => release("forward")}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4L16 14H4L10 4Z" fill="rgba(255,255,255,0.7)" /></svg>
                            </button>

                            {/* Middle row: Left, Backward, Right */}
                            <div className="flex gap-2">
                                <button
                                    className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg touch-none"
                                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press("left"); }}
                                    onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); release("left"); }}
                                    onPointerLeave={() => release("left")}
                                    onPointerCancel={() => release("left")}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10L14 4V16L4 10Z" fill="rgba(255,255,255,0.7)" /></svg>
                                </button>

                                <button
                                    className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg touch-none"
                                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press("backward"); }}
                                    onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); release("backward"); }}
                                    onPointerLeave={() => release("backward")}
                                    onPointerCancel={() => release("backward")}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 16L4 6H16L10 16Z" fill="rgba(255,255,255,0.7)" /></svg>
                                </button>

                                <button
                                    className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg touch-none"
                                    onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press("right"); }}
                                    onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); release("right"); }}
                                    onPointerLeave={() => release("right")}
                                    onPointerCancel={() => release("right")}
                                    onContextMenu={(e) => e.preventDefault()}
                                >
                                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16 10L6 16V4L16 10Z" fill="rgba(255,255,255,0.7)" /></svg>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* WASD Hint (Desktop) */}
                    <div className="absolute bottom-8 right-8 z-30 hidden md:flex flex-col items-center gap-1 opacity-40 pointer-events-none">
                        <div className="font-mono text-[11px] text-white/60 tracking-wider">WASD or Arrows</div>
                        <div className="font-mono text-[11px] text-white/60 tracking-wider">Mouse to look</div>
                    </div>
                </>
            )}

            {/* ========== ENTRY OVERLAY ========== */}
            {!entered && (
                <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md">
                    <h1 className="font-serif text-3xl md:text-5xl text-white tracking-tight mb-8">
                        Exhibition Controls
                    </h1>
                    
                    <div className="flex flex-col gap-6 text-center max-w-sm mb-12 bg-white/5 border border-white/10 p-8 rounded-xl shadow-2xl">
                        <div>
                            <div className="font-sans text-[10px] text-muted tracking-widest uppercase mb-2">Desktop Pointer</div>
                            <div className="font-mono text-white text-[13px]">Press ESC to release mouse pointer</div>
                        </div>
                        <div className="w-12 h-[1px] bg-white/10 mx-auto"></div>
                        <div>
                            <div className="font-sans text-[10px] text-muted tracking-widest uppercase mb-2">Navigation</div>
                            <div className="font-mono text-white text-[13px] leading-relaxed">
                                To walk: point the center dot to the floor near artwork and double click (or tap).
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4 mb-[env(safe-area-inset-bottom)]">
                        <button
                            onClick={completeOnboarding}
                            className="px-8 py-3 bg-primary text-[#1a0f00] font-sans uppercase tracking-[0.15em] text-[11px] font-bold hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(242,202,80,0.15)]"
                        >
                            Enter Exhibition
                        </button>
                        <button
                            onClick={() => setEntered(true)}
                            className="px-8 py-3 bg-transparent text-white/50 font-sans uppercase tracking-[0.15em] text-[11px] hover:text-white border border-white/10 active:scale-95 hover:bg-white/5 transition-all"
                        >
                            Ignore Instructions
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
