"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Section } from "@/components/layout/Section";
import { ArtGrid } from "@/components/gallery/ArtGrid";
import { ArtCard } from "@/components/gallery/ArtCard";
import type { Artwork } from "@/features/artwork/data/artworks";

interface GalleryProps {
  artworks: Artwork[];
}

export function Gallery({ artworks }: GalleryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Section className="pt-8 pb-32" id="gallery">
      <div className="mb-10 flex flex-col items-center text-center">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls="selected-works-grid"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          className="group flex min-h-12 flex-col items-center justify-center rounded-sm px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
        >
          <span className="flex items-center gap-3">
            <span className="font-serif text-[40px] leading-tight tracking-[-0.03em] text-text md:text-[56px]">
              Selected Works
            </span>
            <ChevronDown
              aria-hidden="true"
              size={20}
              strokeWidth={1.5}
              className={`text-primary transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
            />
          </span>
          <span className="mt-1 font-sans text-[9px] uppercase tracking-[0.2em] text-muted/70 transition-colors group-hover:text-primary">
            {isExpanded ? "Hide collection" : `View collection · ${artworks.length} artworks`}
          </span>
        </button>
        <div className="mt-4 h-px w-12 bg-primary/50" />
      </div>

      <div
        id="selected-works-grid"
        aria-hidden={!isExpanded}
        inert={!isExpanded}
        hidden={!isExpanded}
      >
        {artworks.length > 0 ? (
          <ArtGrid>
            {artworks.map((art, index) => (
              <ArtCard key={art.id} artwork={art} index={index} />
            ))}
          </ArtGrid>
        ) : (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/10 py-20 text-center">
            <p className="font-serif italic text-zinc-500">The curator is currently selecting new works for the collection.</p>
          </div>
        )}
      </div>
    </Section>
  );
}
