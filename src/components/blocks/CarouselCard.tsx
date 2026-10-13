"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Ref } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Artwork } from "@/features/artwork/data/artworks";

interface CarouselCardProps {
  artwork: Artwork;
  isClone?: boolean;
  priority?: boolean;
  cardWidth: number;
  cardHeight: number;
  ref?: Ref<HTMLAnchorElement>;
}

export function CarouselCard({
  artwork,
  isClone = false,
  priority = false,
  cardWidth,
  cardHeight,
  ref,
}: CarouselCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const linkProps = isClone
    ? { tabIndex: -1 as const, "aria-hidden": true as const }
    : {};

  return (
    <Link
      ref={ref}
      href={`/artwork/${artwork.id}`}
      className="carousel-card group relative block flex-shrink-0 overflow-hidden outline-none focus-visible:ring-1 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0a0a0a]"
      style={{ width: cardWidth, height: cardHeight }}
      {...linkProps}
    >
      {/* Shimmer placeholder */}
      <Skeleton className="absolute inset-0 z-0" />

      {/* Artwork image */}
      {!imageFailed && <Image
        src={artwork.imageUrl}
        alt={isClone ? "" : `${artwork.title} by ${artwork.artist}`}
        fill
        sizes={`${cardWidth}px`}
        className="relative z-10 object-cover transition-transform duration-[250ms] ease-out group-hover:scale-[1.025]"
        placeholder="blur"
        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        priority={priority}
        onError={() => setImageFailed(true)}
      />}

      {imageFailed && <div className="absolute inset-0 z-10 grid place-items-center px-6 text-center bg-surface-highest">
        <span className="font-serif text-xl text-text/75">{artwork.title}</span>
      </div>}

      {/* Hover overlay — desktop only */}
      <div className="absolute inset-0 z-20 flex flex-col justify-end p-4 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 lg:group-hover:opacity-100 transition-opacity duration-500 ease-editorial pointer-events-none">
        <h3 className="font-serif text-[15px] text-white tracking-wide font-light leading-snug">
          {artwork.title}
        </h3>
        <p className="font-sans text-[11px] text-white/60 mt-1 tracking-wide">
          {artwork.artist}
        </p>
      </div>

      {/* Subtle border */}
      <div className="absolute inset-0 z-15 border border-white/[0.06] pointer-events-none" />
    </Link>
  );
}
