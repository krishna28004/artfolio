"use client";
import Image from "next/image";
import Link from "next/link";
import { Artwork } from "@/features/artwork/data/artworks";
import { Skeleton } from "@/components/ui/Skeleton";

import { Heart } from "lucide-react";
import { useFavorites } from "@/features/favorites/hooks/use-favorites";
import { useState } from "react";
import { formatRupees } from "@/shared/utils/money";

interface ArtCardProps {
  artwork: Artwork;
  index?: number;
  priority?: boolean;
}

export function ArtCard({ artwork, index = 0, priority = false }: ArtCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const { isFavorite, toggleFavorite } = useFavorites();
  const staggerClass = index < 12 ? `stagger-${(index % 3) + 1}` : "";

  return (
    <article className={`group flex flex-col gap-6 animate-reveal ${staggerClass}`}>
      {/* 4:5 Aspect Ratio Container (No intrinsic background, art provides its own texture) */}
      <div className="relative aspect-[4/5] w-full overflow-hidden border border-transparent bg-[#080808] transition-colors duration-[500ms] ease-editorial group-hover:border-primary/30 group-focus-within:border-primary/40">
        <Link href={`/artwork/${artwork.id}`} aria-label={`View ${artwork.title}`} className="absolute inset-0 z-10 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Skeleton className="absolute inset-0 z-0 bg-white/5" />
          {imageFailed ? (
            <div role="img" aria-label={`${artwork.title} image unavailable`} className="absolute inset-0 z-10 flex items-center justify-center bg-[#080808] px-6 text-center font-sans text-xs uppercase tracking-[0.18em] text-muted">
              Image unavailable
            </div>
          ) : <Image
            src={artwork.thumbnailUrl || artwork.imageUrl}
            alt={artwork.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
            className="relative z-10 object-contain transition-transform duration-[1200ms] ease-editorial motion-safe:group-hover:scale-[1.03] will-change-transform"
            priority={priority}
            onError={() => setImageFailed(true)}
            placeholder="blur"
            blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
          />}
          <div className="absolute inset-0 bg-black/0 transition-colors duration-[1200ms] ease-editorial group-hover:bg-black/20 pointer-events-none" />
        </Link>

        {/* Floating Heart Icon */}
        <button
          onClick={() => toggleFavorite(artwork.id)}
          type="button"
          aria-label={`${isFavorite(artwork.id) ? "Remove" : "Add"} ${artwork.title} ${isFavorite(artwork.id) ? "from" : "to"} saved artworks`}
          aria-pressed={isFavorite(artwork.id)}
          className="absolute top-4 right-4 z-20 p-3 rounded-full bg-black/45 backdrop-blur-md border border-white/15 opacity-100 translate-y-0 transition-all duration-[250ms] ease-out md:opacity-0 md:translate-y-2 md:group-hover:opacity-100 md:group-hover:translate-y-0 hover:bg-black/60 focus:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <Heart
            className={`w-4 h-4 transition-colors duration-500 ${isFavorite(artwork.id) ? 'fill-white text-white' : 'text-white/70 hover:text-white'}`}
          />
        </button>

      </div>

      {/* Typography Hierarchy (Dematerialized) */}
      <div className="flex translate-y-0 flex-col gap-2 opacity-80 transition-all duration-[500ms] ease-editorial group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-within:-translate-y-0.5 group-focus-within:opacity-100">
        <div className="flex justify-between items-baseline border-b border-white/10 group-hover:border-white/30 pb-3 transition-colors duration-[800ms]">
          <Link href={`/artwork/${artwork.id}`} className="outline-none focus-visible:underline">
            <h3 className="font-serif text-[20px] text-white tracking-wide font-light">{artwork.title}</h3>
          </Link>
          <span className="font-sans text-[11px] text-white/50 tracking-widest">{artwork.year}</span>
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <p className="font-sans text-[12px] text-white/60 font-light">{artwork.artist}</p>
          {artwork.price && artwork.isAvailable && (
            <p className="font-sans text-[12px] text-white tracking-widest">{formatRupees(artwork.price)}</p>
          )}
          {!artwork.isAvailable && (
            <p className="font-sans text-[10px] text-white/40 tracking-[0.2em] uppercase">{artwork.saleStatus === "sold" ? "Sold" : artwork.saleStatus === "reserved" ? "Reserved" : "Not for sale"}</p>
          )}
        </div>
      </div>
    </article>
  );
}
