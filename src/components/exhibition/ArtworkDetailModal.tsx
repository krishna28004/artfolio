"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import type { GalleryArtwork } from "./GalleryScene";

export interface ArtworkDetailModalProps {
  artwork: GalleryArtwork | null;
  isOpen: boolean;
  onClose: () => void;
  prefersReducedMotion?: boolean;
}

export function ArtworkDetailModal({
  artwork,
  isOpen,
  onClose,
  prefersReducedMotion = false,
}: ArtworkDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [loadedArtworkId, setLoadedArtworkId] = useState<string | null>(null);
  const [errorArtworkId, setErrorArtworkId] = useState<string | null>(null);

  const imageLoaded = loadedArtworkId === artwork?.id;
  const imageError = errorArtworkId === artwork?.id;

  // Manage focus trap and restoration
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      // Focus close button on open for clean accessibility
      const focusTimer = setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

      // Lock body scroll
      document.body.style.overflow = "hidden";

      return () => {
        clearTimeout(focusTimer);
        document.body.style.overflow = "";
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen]);

  // Handle ESC key and focus trapping within the modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === "Escape" || e.code === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const firstElement = focusable[0];
        const lastElement = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !artwork) {
    return null;
  }

  const formattedPrice =
    typeof artwork.price === "number" && artwork.price > 0
      ? new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency: "INR",
          maximumFractionDigits: 0,
        }).format(artwork.price)
      : undefined;

  const isAvailable = artwork.isAvailable !== false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10 select-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="artwork-modal-title"
      aria-describedby="artwork-modal-desc"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity duration-300 ${
          prefersReducedMotion ? "" : "animate-in fade-in"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        ref={modalRef}
        className={`relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto overscroll-contain bg-[#0d0d0e] border border-white/15 rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col md:flex-row text-white ${
          prefersReducedMotion
            ? ""
            : "animate-in fade-in zoom-in-95 duration-200"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button Top-Right (44px touch target) */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          aria-label="Close artwork details"
          className="absolute top-3.5 right-3.5 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white/80 hover:text-white border border-white/10 focus:ring-2 focus:ring-primary focus:outline-none"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Left Column: Artwork Image Showcase */}
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col items-center justify-center bg-black/40 border-b md:border-b-0 md:border-r border-white/10 relative">
          <div className="relative w-full max-w-sm aspect-[3/4] flex items-center justify-center bg-[#151515] rounded-lg overflow-hidden border border-white/10 shadow-2xl">
            {/* Loading Shimmer */}
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 bg-white/5 animate-pulse flex items-center justify-center">
                <span className="font-mono text-[10px] tracking-widest uppercase text-white/40">
                  Loading Canvas...
                </span>
              </div>
            )}

            {/* Error Placeholder */}
            {imageError ? (
              <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
                <svg
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-white/30"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <p className="font-serif text-sm text-white/60">
                  {artwork.title || "Fine Art Piece"}
                </p>
                <p className="text-[10px] text-white/30 uppercase tracking-widest">
                  Archival Frame
                </p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={artwork.url}
                alt={artwork.title || "Artfolio Virtual Exhibition Artwork"}
                className={`max-w-full max-h-full object-contain rounded shadow-lg transition-opacity duration-300 ${
                  imageLoaded ? "opacity-100" : "opacity-0"
                }`}
                onLoad={() => setLoadedArtworkId(artwork.id)}
                onError={() => setErrorArtworkId(artwork.id)}
              />
            )}
          </div>

          <p className="mt-4 font-mono text-[10px] text-white/30 tracking-widest uppercase">
            Curated Physical Original
          </p>
        </div>

        {/* Right Column: Curatorial Metadata & Actions */}
        <div className="md:w-1/2 p-6 md:p-8 flex flex-col justify-between">
          <div>
            {/* Curatorial Header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="font-sans text-[10px] uppercase tracking-[0.25em] text-primary/90 font-medium">
                Artfolio Permanent Collection
              </span>
            </div>

            <h2
              id="artwork-modal-title"
              className="font-serif text-2xl md:text-3xl text-white font-normal tracking-wide leading-tight mb-2"
            >
              {artwork.title || "Untitled Masterwork"}
            </h2>

            <p className="font-sans text-sm text-white/70 mb-4">
              <span className="font-medium text-white/90">
                {artwork.artist || "Krishna Kumar"}
              </span>
              {artwork.year ? ` · ${artwork.year}` : ""}
            </p>

            {/* Medium, Dimensions, Availability Tag */}
            <div className="flex flex-wrap gap-2 mb-6">
              {artwork.medium && (
                <span className="font-sans text-[11px] text-white/80 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                  {artwork.medium}
                </span>
              )}
              {artwork.dimensions && (
                <span className="font-sans text-[11px] text-white/80 bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
                  {artwork.dimensions}
                </span>
              )}
              <span
                className={`font-sans text-[11px] px-2.5 py-1 rounded-md border ${
                  isAvailable
                    ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/40"
                    : "bg-white/5 text-white/40 border-white/10"
                }`}
              >
                {isAvailable ? "Available for Acquisition" : "Private Collection"}
              </span>
            </div>

            {/* Curatorial Description */}
            <div className="border-t border-white/10 pt-4 mb-6">
              <h3 className="text-[10px] font-sans uppercase tracking-widest text-white/40 mb-2">
                Curatorial Note
              </h3>
              <p
                id="artwork-modal-desc"
                className="font-sans text-xs md:text-sm text-white/70 leading-relaxed max-h-44 overflow-y-auto pr-2"
              >
                {artwork.description ||
                  "A distinguished study in photorealistic graphite, exploring the delicate interplay of light, form, and observational craftsmanship."}
              </p>
            </div>
          </div>

          {/* Pricing & Acquisition Footer */}
          <div className="border-t border-white/10 pt-5 mt-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="font-sans text-[10px] uppercase tracking-widest text-white/40 block">
                  Valuation
                </span>
                <span className="font-serif text-lg text-primary font-medium">
                  {formattedPrice || "Price Upon Request"}
                </span>
              </div>
              <span className="font-mono text-[9px] text-white/30 uppercase tracking-widest">
                ID: {artwork.id}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                href={`/artwork/${artwork.id}`}
                className="flex-1 py-3 px-5 bg-primary text-[#1a0f00] font-sans font-bold text-xs uppercase tracking-widest text-center rounded-lg hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(242,202,80,0.2)] focus:ring-2 focus:ring-primary focus:outline-none min-h-[44px] flex items-center justify-center"
              >
                Acquisition Dossier &rarr;
              </Link>
              <button
                onClick={onClose}
                className="py-3 px-5 bg-white/5 text-white/80 font-sans text-xs uppercase tracking-widest text-center rounded-lg hover:bg-white/10 active:scale-95 transition-all border border-white/10 focus:ring-2 focus:ring-primary focus:outline-none min-h-[44px] flex items-center justify-center"
              >
                Return to Gallery [Esc]
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
