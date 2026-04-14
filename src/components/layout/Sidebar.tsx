"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        queueMicrotask(() => {
            setMounted(true);
        });
    }, []);

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
                className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface-lowest border-l border-white/5 z-50 pt-24 px-10 md:px-16 pb-12 flex flex-col transition-transform duration-700 ease-editorial shadow-ambient ${isOpen ? "translate-x-0" : "translate-x-full"}`}
            >
                {/* Close Button X */}
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center text-muted hover:text-primary transition-colors group"
                >
                    <div className="relative w-6 h-6">
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-current rotate-45 transform origin-center transition-transform group-hover:rotate-[135deg] duration-700"></div>
                        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-current -rotate-45 transform origin-center transition-transform group-hover:-rotate-[135deg] duration-700"></div>
                    </div>
                </button>

                <nav className="flex flex-col gap-8 flex-1 mt-12">
                    <Link href="/#gallery" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Artworks
                    </Link>
                    <Link href="/saved" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Saved Collection
                    </Link>
                    <Link href="/exhibition" onClick={onClose} className="font-serif text-[32px] text-text/70 hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Digital Exhibition
                    </Link>
                    <Link href="/artwork/luminous-veil?wallfit=true" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        WallFit
                    </Link>
                    <Link href="/commission" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Commission
                    </Link>
                    <Link href="/learning" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        Learning
                    </Link>
                    <Link href="/#about" onClick={onClose} className="font-serif text-[32px] text-text hover:text-primary transition-colors tracking-wide duration-[600ms]">
                        About
                    </Link>
                </nav>

                <div className="mt-auto border-t border-white/10 pt-8 flex flex-col gap-4">
                    <p className="font-sans text-[11px] uppercase tracking-[0.2em] text-muted">Contact</p>
                    <a href="https://mail.google.com/mail/?view=cm&to=krishnakumar2811004@gmail.com" target="_blank" rel="noopener noreferrer" className="font-sans text-[14px] text-text hover:text-primary transition-colors">krishnakumar2811004@gmail.com</a>
                </div>
            </div>
        </>
    );
}
