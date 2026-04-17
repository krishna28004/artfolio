"use client";
import Image from "next/image";
import Link from "next/link";
import { Artwork } from "@/features/artwork/data/artworks";
import { Skeleton } from "@/components/ui/Skeleton";

import { Heart } from "lucide-react";
import { useFavorites } from "@/features/favorites/hooks/use-favorites";

interface ArtCardProps {
  artwork: Artwork;
  index?: number;
}

export function ArtCard({ artwork, index = 0 }: ArtCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const staggerClass = index < 12 ? `stagger-${(index % 3) + 1}` : "";

  return (
    <Link
      href={`/artwork/${artwork.id}`}
      className={`group flex flex-col gap-6 block animate-reveal ${staggerClass} outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-8 focus-visible:ring-offset-bg rounded-sm`}
    >
      {/* 4:5 Aspect Ratio Container (No intrinsic background, art provides its own texture) */}
      <div className="relative aspect-[4/5] w-full overflow-hidden border border-transparent transition-colors duration-[1200ms] ease-editorial">
        {/* Shimmer Placeholder until Image loads */}
        <Skeleton className="absolute inset-0 z-0 bg-white/5" />
        <Image
          src={artwork.imageUrl}
          alt={artwork.title}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="relative z-10 object-cover transition-transform duration-[1200ms] ease-editorial motion-safe:group-hover:scale-[1.03] will-change-transform"
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        />

        {/* Floating Heart Icon */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavorite(artwork.id);
          }}
          className="absolute top-4 right-4 z-20 p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/5 opacity-0 translate-y-2 transition-all duration-[800ms] ease-editorial group-hover:opacity-100 group-hover:translate-y-0 hover:bg-black/40 focus:opacity-100 outline-none focus-visible:ring-1 focus-visible:ring-white"
        >
          <Heart
            className={`w-4 h-4 transition-colors duration-500 ${isFavorite(artwork.id) ? 'fill-white text-white' : 'text-white/70 hover:text-white'}`}
          />
        </button>

        {/* Subtle overlay on hover */}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-[1200ms] ease-editorial group-hover:bg-black/20 pointer-events-none" />
      </div>

      {/* Typography Hierarchy (Dematerialized) */}
      <div className="flex flex-col gap-2 transition-opacity duration-[800ms] ease-editorial opacity-80 group-hover:opacity-100">
        <div className="flex justify-between items-baseline border-b border-white/10 group-hover:border-white/30 pb-3 transition-colors duration-[800ms]">
          <h3 className="font-serif text-[20px] text-white tracking-wide font-light">{artwork.title}</h3>
          <span className="font-sans text-[11px] text-white/50 tracking-widest">{artwork.year}</span>
        </div>
        <div className="flex justify-between items-baseline mt-1">
          <p className="font-sans text-[12px] text-white/60 font-light">{artwork.artist}</p>
          {artwork.price && artwork.isAvailable && (
            <p className="font-sans text-[12px] text-white tracking-widest">₹{artwork.price.toLocaleString()}</p>
          )}
          {!artwork.isAvailable && (
            <p className="font-sans text-[10px] text-white/40 tracking-[0.2em] uppercase">Sold</p>
          )}
        </div>
      </div>
    </Link>
  );
}
