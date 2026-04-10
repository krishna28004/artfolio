"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Container } from "./Container";
import { Sidebar } from "./Sidebar";
import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";

export function Navbar() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { favorites } = useFavorites();

  // Prevent scrolling when sidebar is open
  useEffect(() => {
    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isSidebarOpen]);

  return (
    <>
      <header className="fixed top-0 z-40 w-full glass-panel">
        <Container>
          <div className="flex h-20 items-center justify-between">
            <Link href="/" className="group flex flex-col items-start gap-0.5">
              <span className="text-[28px] sm:text-[32px] font-serif tracking-[0.2em] font-light bg-clip-text text-transparent bg-gradient-to-r from-[#d9b870] via-[#ffebb8] to-[#bd9544] transition-all duration-700 group-hover:brightness-125">
                ARTFOLIO
              </span>
              <span className="block w-full h-[1px] bg-gradient-to-r from-[#d9b870]/80 via-[#ffebb8]/40 to-transparent scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-700"></span>
            </Link>

            <div className="flex items-center gap-8">
              {/* Saved Collection Link (Desktop) */}
              <Link
                href="/saved"
                className="hidden md:flex items-center gap-2 text-muted/60 hover:text-primary transition-all duration-500 relative group"
              >
                <Heart className={`w-4 h-4 transition-colors duration-500 ${favorites.length > 0 ? 'fill-primary text-primary' : ''}`} />
                <span className="font-sans text-[11px] uppercase tracking-[0.2em]">Saved</span>
                {favorites.length > 0 && (
                  <span className="absolute -top-1.5 -right-2 w-3.5 h-3.5 bg-primary text-black text-[8px] font-bold rounded-full flex items-center justify-center animate-in zoom-in duration-300">
                    {favorites.length}
                  </span>
                )}
              </Link>

              {/* Hamburger Button */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="flex flex-col justify-center items-center w-10 h-10 gap-1.5 group z-50"
                aria-label="Open Menu"
              >
                <div className="w-8 h-[1px] bg-text group-hover:bg-primary transition-colors duration-[600ms]"></div>
                <div className="w-8 h-[1px] bg-text group-hover:bg-primary transition-colors duration-[600ms]"></div>
                <div className="w-8 h-[1px] bg-text group-hover:bg-primary transition-colors duration-[600ms]"></div>
              </button>
            </div>
          </div>
        </Container>
      </header>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  );
}
