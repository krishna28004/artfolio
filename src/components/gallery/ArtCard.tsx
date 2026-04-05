"use client";
import Image from "next/image";
import Link from "next/link";
import { Artwork } from "@/lib/data/placeholders";
import { Skeleton } from "@/components/ui/Skeleton";

import { Heart } from "lucide-react";
import { useFavorites } from "@/hooks/useFavorites";

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
      className={`group flex flex-col gap-6 block animate-reveal ${staggerClass}`}
    >
      {/* 4:5 Aspect Ratio Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-low border border-transparent transition-colors duration-[600ms] ease-editorial group-hover:border-outline-variant/30">
        {/* Shimmer Placeholder until Image loads */}
        <Skeleton className="absolute inset-0 z-0" />
        <Image
          src={artwork.imageUrl}
          alt={artwork.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="relative z-10 object-cover transition-transform duration-[1500ms] ease-[cubic-bezier(0.25,1,0.3,1)] group-hover:scale-105"
          onLoad={() => {
            // Optional: Hide skeleton or fade in image more explicitly if needed
            // But next/image with placeholder="blur" handles most of it.
          }}
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
          className="absolute top-4 right-4 z-20 p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/5 opacity-0 translate-y-2 transition-all duration-500 ease-editorial group-hover:opacity-100 group-hover:translate-y-0 hover:bg-black/40"
        >
          <Heart
            className={`w-4 h-4 transition-colors duration-300 ${isFavorite(artwork.id) ? 'fill-primary text-primary' : 'text-white/70'}`}
          />
        </button>

        {/* Subtle overlay on hover */}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-[600ms] group-hover:bg-black/10" />
      </div>

      {/* Typography Hierarchy */}
      <div className="flex flex-col gap-2 transition-opacity duration-[600ms] ease-editorial">
        <div className="flex justify-between items-baseline border-b border-transparent group-hover:border-outline-variant/30 pb-2 transition-colors duration-[600ms]">
          <h3 className="font-serif text-[24px] text-text tracking-wide">{artwork.title}</h3>
          <span className="font-sans text-[12px] text-muted tracking-widest">{artwork.year}</span>
        </div>
        <div className="flex justify-between items-baseline">
          <p className="font-sans text-[13px] text-muted font-light">{artwork.artist}</p>
          {artwork.price && artwork.isAvailable && (
            <p className="font-sans text-[12px] text-primary tracking-widest">${artwork.price.toLocaleString()}</p>
          )}
          {!artwork.isAvailable && (
            <p className="font-sans text-[10px] text-muted/50 tracking-[0.2em] uppercase">Sold</p>
          )}
        </div>
      </div>
    </Link>
  );
}
