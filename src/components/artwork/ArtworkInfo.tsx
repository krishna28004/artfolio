"use client";
import Link from "next/link";
import { useState } from "react";
import dynamic from "next/dynamic";

// Next.js dynamic imperative import explicitly skipping SSR to prevent Canvas initialization fatal crashes
const WallFitOverlay = dynamic(
  () => import("@/components/wallfit/WallFitLayout").then((mod) => mod.WallFitLayout),
  { ssr: false }
);

interface ArtworkInfoProps {
  title: string;
  artist: string;
  year: string;
  medium?: string;
  dimensions?: string;
  description: string;
  imageUrl?: string;
}

export function ArtworkInfo({ title, artist, year, medium, dimensions, description, imageUrl }: ArtworkInfoProps) {
  const [simOpen, setSimOpen] = useState(false);
  
  // High-def default artwork mock URL for WallFit Simulation when API is locally unreachable
  const targetImg = imageUrl || "https://images.unsplash.com/photo-1541961017774-22349e4a1262?q=80&w=1500";

  return (
    <>
      {simOpen && <WallFitOverlay artworkUrl={targetImg} onClose={() => setSimOpen(false)} />}
      <div className="flex flex-col h-full justify-center">
        
        {/* Editorial Header Array */}
        <div className="mb-10">
          <h1 className="font-serif text-[40px] md:text-[56px] text-text leading-[1.1] tracking-[-0.02em] mb-4">
            {title}
          </h1>
          <div className="flex items-center gap-3 font-sans text-[14px] text-muted tracking-[0.15em] uppercase">
            <span className="text-text/80 font-medium">{artist}</span>
            <span className="w-1 h-1 rounded-full bg-accent/50"></span>
            <span>{year}</span>
          </div>
        </div>

        {/* Archival Metadata */}
        {(medium || dimensions) && (
          <div className="flex flex-col gap-1 mb-8 font-sans text-[13px] text-muted/60 uppercase tracking-widest">
            {medium && <span>{medium}</span>}
            {dimensions && <span>{dimensions}</span>}
          </div>
        )}

        {/* Curatorial Context */}
        <p className="font-sans text-[16px] text-muted/80 leading-[1.8] font-light max-w-md mb-12">
          {description}
        </p>

        {/* Dual CTA Actions */}
        <div className="mt-auto flex flex-col gap-4 max-w-sm">
          <button 
            onClick={() => setSimOpen(true)}
            className="inline-flex justify-center items-center gap-3 px-10 py-5 border border-white/10 text-muted uppercase text-[11px] tracking-[0.2em] font-sans font-medium transition-all duration-[600ms] hover:border-white/30 hover:text-white"
          >
            {/* SVG AI Reticle Icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square"><path d="M4 4h16v16H4z"/><path d="M4 14l5-5 4 4 6-6"/></svg>
            Visualize in Space
          </button>
          
          <Link 
            href={`/commission?ref=${encodeURIComponent(title)}`}
            className="inline-flex justify-center px-10 py-5 border border-accent text-accent uppercase text-[11px] font-sans tracking-[0.2em] font-bold transition-all duration-[600ms] hover:bg-accent hover:text-black"
          >
            Secure Commission
          </Link>
        </div>

      </div>
    </>
  );
}
