"use client";
// Refinement pass for professional editorial feel
import Link from "next/link";
import { useState } from "react";
import { Eye, Heart, Share2, Check } from "lucide-react";
import { useFavorites } from "@/features/favorites/hooks/use-favorites";
import { useViewCount } from "@/features/artwork/hooks/use-view-count";

interface ArtworkInfoProps {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium?: string;
  dimensions?: string;
  description: string;
}

export function ArtworkInfo({ id, title, artist, year, medium, dimensions, description }: ArtworkInfoProps) {
  const [copied, setCopied] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const { views } = useViewCount(id);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`Take a look at this masterpiece: ${title} by ${artist}. \n\nView here: ${window.location.href}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <>
      <div className="flex flex-col h-full justify-center">

        {/* Subtle Popularity Badge (Archival style) */}
        <div className="flex items-center gap-1.5 mb-6 text-[11px] uppercase tracking-[0.2em] text-muted/40 font-sans">
          <Eye className="w-3 h-3" />
          <span>{views !== null ? `Ref. ${views} Views` : `Archival Masterpiece`}</span>
        </div>

        {/* Editorial Header Array */}
        <div className="mb-10 relative">
          <h1 className="font-serif text-[40px] md:text-[56px] text-text leading-[1.1] tracking-[-0.02em] mb-4">
            {title}
          </h1>
          <div className="flex items-center gap-3 font-sans text-[14px] text-muted tracking-[0.15em] uppercase">
            <span className="text-text/80 font-medium">{artist}</span>
            <span className="w-1 h-1 rounded-full bg-primary/50"></span>
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

        {/* Global Engagement Actions */}
        <div className="flex items-center gap-6 mb-12 border-b border-white/5 pb-8">
          <button
            onClick={() => toggleFavorite(id)}
            className="group flex items-center gap-2 text-[12px] uppercase tracking-widest text-text/80 hover:text-primary transition-colors duration-500"
          >
            <Heart className={`w-4 h-4 transition-all duration-500 group-hover:scale-110 ${isFavorite(id) ? 'fill-primary text-primary' : ''}`} />
            <span>{isFavorite(id) ? 'Saved' : 'Save to Collection'}</span>
          </button>

          <div className="w-[1px] h-4 bg-white/10"></div>

          <div className="flex items-center gap-4">
            <button
              onClick={handleWhatsAppShare}
              className="p-2 text-muted/50 hover:text-primary transition-colors duration-500"
              title="Share on WhatsApp"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-muted/50 hover:text-text transition-colors duration-500"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : null}
              <span>{copied ? 'Link Copied' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Dual CTA Actions */}
        <div className="mt-auto flex flex-col gap-4 max-w-sm">
          <Link
            href={`/commission?ref=${encodeURIComponent(title)}`}
            className="inline-flex justify-center px-10 py-5 bg-transparent border border-primary text-primary uppercase text-[11px] font-sans tracking-[0.2em] font-bold transition-all duration-[600ms] hover:bg-primary hover:text-black active:scale-[0.98]"
          >
            Secure Commission
          </Link>
        </div>

      </div>
    </>
  );
}
