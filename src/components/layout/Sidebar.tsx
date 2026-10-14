"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const [mounted, setMounted] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        queueMicrotask(() => {
            setMounted(true);
        });
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const focusFrame = requestAnimationFrame(() => closeRef.current?.focus());
        const trapFocus = (event: KeyboardEvent) => {
            if (event.key !== "Tab" || !panelRef.current) return;
            const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled])'
            ));
            if (!items.length) return;
            const first = items[0];
            const last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault(); last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault(); first.focus();
            }
        };
        window.addEventListener("keydown", trapFocus);
        return () => { cancelAnimationFrame(focusFrame); window.removeEventListener("keydown", trapFocus); };
    }, [isOpen]);

    if (!mounted) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity duration-700 ease-editorial ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div
                ref={panelRef}
                id="site-menu-panel"
                role="dialog"
                aria-label="Site menu"
                aria-modal={isOpen}
                aria-hidden={!isOpen}
                inert={!isOpen}
                className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface-lowest border-l border-white/5 z-50 pt-20 px-10 md:px-16 pb-10 flex flex-col overflow-y-auto transition-transform duration-700 ease-editorial shadow-ambient ${isOpen ? "translate-x-0" : "translate-x-full"}`}
            >
                {/* Close Button X */}
                <button
                    ref={closeRef}
                    onClick={onClose}
                    aria-label="Close menu"
                    className="absolute top-6 right-8 w-11 h-11 flex items-center justify-center text-muted hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary transition-colors group"
                >
                    <div className="relative w-6 h-6">
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-current rotate-45 transform origin-center transition-transform group-hover:rotate-[135deg] duration-700"></div>
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-current -rotate-45 transform origin-center transition-transform group-hover:-rotate-[135deg] duration-700"></div>
                    </div>
                </button>

                <nav className="flex flex-col gap-5 sm:gap-7 flex-1 mt-10">
                    <Link href="/#gallery" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Artworks
                    </Link>
                    <Link href="/saved" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Saved Collection
                    </Link>
                    <Link href="/exhibition" onClick={onClose} className="font-serif text-[32px] text-text/70 hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Digital Exhibition
                    </Link>
                    <Link href="/commission" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Commission
                    </Link>
                    <Link href="/learning" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Learning
                    </Link>
                    <Link href="/admin/login" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Studio Login
                    </Link>
                    <Link href="/#about" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        About
                    </Link>
                </nav>

                <div className="mt-auto border-t border-white/10 pt-8 flex flex-col gap-4">
                    <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted">Contact</p>
                    <a href="mailto:krishnakumar2811004@gmail.com" className="font-sans text-[14px] text-text hover:text-primary transition-colors">krishnakumar2811004@gmail.com</a>
                </div>
            </div>
        </>
    );
}
