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
                    {/* Top Bar */}
                    <div className="absolute top-0 left-0 w-full z-20 p-6 flex justify-between items-start pointer-events-none">
                        <div>
                            <p className="font-serif text-primary text-xl tracking-[0.1em]">Digital Exhibition</p>
                            <p className="font-sans text-muted text-[10px] tracking-[0.15em] uppercase mt-1 opacity-70">
                                Walk freely · Explore the artworks
                            </p>
                        </div>
                        <Link
                            href="/"
                            className="pointer-events-auto font-sans text-[10px] uppercase tracking-widest text-[#a0a0a0] hover:text-white transition-colors border border-white/10 hover:border-white/30 bg-black/60 backdrop-blur-sm px-5 py-2.5"
                        >
                            Exit
                        </Link>
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
                    <div className="absolute bottom-8 left-8 z-30 flex flex-col items-center gap-2">
                        {/* Forward */}
                        <button
                            className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg"
                            onPointerDown={() => press("forward")}
                            onPointerUp={() => release("forward")}
                            onPointerLeave={() => release("forward")}
                            onContextMenu={(e) => e.preventDefault()}
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 4L16 14H4L10 4Z" fill="rgba(255,255,255,0.7)" /></svg>
                        </button>

                        {/* Middle row: Left, Backward, Right */}
                        <div className="flex gap-2">
                            <button
                                className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg"
                                onPointerDown={() => press("left")}
                                onPointerUp={() => release("left")}
                                onPointerLeave={() => release("left")}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10L14 4V16L4 10Z" fill="rgba(255,255,255,0.7)" /></svg>
                            </button>

                            <button
                                className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg"
                                onPointerDown={() => press("backward")}
                                onPointerUp={() => release("backward")}
                                onPointerLeave={() => release("backward")}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 16L4 6H16L10 16Z" fill="rgba(255,255,255,0.7)" /></svg>
                            </button>

                            <button
                                className="w-14 h-14 flex items-center justify-center bg-black/50 backdrop-blur-md border border-white/15 active:bg-white/20 transition-colors rounded-lg"
                                onPointerDown={() => press("right")}
                                onPointerUp={() => release("right")}
                                onPointerLeave={() => release("right")}
                                onContextMenu={(e) => e.preventDefault()}
                            >
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M16 10L6 16V4L16 10Z" fill="rgba(255,255,255,0.7)" /></svg>
                            </button>
                        </div>
                    </div>

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
                    <h1 className="font-serif text-5xl md:text-6xl text-white tracking-tight mb-4">
                        Enter the Exhibition
                    </h1>
                    <p className="font-sans text-[#a0a0a0] text-[15px] tracking-wider mb-14 max-w-md text-center leading-relaxed">
                        Walk freely through a curated virtual hall featuring Krishna Kumar&apos;s handmade pencil sketches.
                    </p>
                    <button
                        onClick={() => setEntered(true)}
                        className="px-14 py-4 bg-primary text-[#1a0f00] font-sans uppercase tracking-[0.15em] text-[12px] font-bold hover:brightness-110 transition-all shadow-[0_0_40px_rgba(242,202,80,0.15)]"
                    >
                        Enter Gallery
                    </button>

                    <div className="absolute bottom-10 flex gap-8 text-center">
                        <div>
                            <div className="font-sans text-[10px] text-muted/50 tracking-widest uppercase mb-1">Move</div>
                            <div className="font-mono text-white text-sm">W A S D</div>
                        </div>
                        <div>
                            <div className="font-sans text-[10px] text-muted/50 tracking-widest uppercase mb-1">Look</div>
                            <div className="font-mono text-white text-sm">Mouse</div>
                        </div>
                        <div>
                            <div className="font-sans text-[10px] text-muted/50 tracking-widest uppercase mb-1">Mobile</div>
                            <div className="font-mono text-white text-sm">Buttons</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
