import Image from "next/image";
import Link from "next/link";
import { Artwork } from "@/lib/data/placeholders";

interface ArtCardProps {
  artwork: Artwork;
}

export function ArtCard({ artwork }: ArtCardProps) {
  return (
    <Link href={`/artwork/${artwork.id}`} className="group flex flex-col gap-4 block">
      {/* 4:5 Aspect Ratio Container */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#0a0a0a] border border-white/5 shadow-2xl">
        <Image
          src={artwork.imageUrl}
          alt={artwork.title}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-105"
          placeholder="blur"
          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        />
        {/* Subtle overlay on hover */}
        <div className="absolute inset-0 bg-black/0 transition-colors duration-500 group-hover:bg-black/20" />
      </div>

      {/* Typography Hierarchy */}
      <div className="flex flex-col gap-1 transition-opacity duration-300 group-hover:opacity-80">
        <div className="flex justify-between items-baseline">
          <h3 className="text-lg font-medium text-white tracking-wide">{artwork.title}</h3>
          <span className="text-sm text-zinc-500">{artwork.year}</span>
        </div>
        <p className="text-sm text-zinc-400 font-light">{artwork.artist}</p>
        {artwork.price && artwork.isAvailable && (
          <p className="text-sm text-zinc-300 mt-1">${artwork.price.toLocaleString()}</p>
        )}
        {!artwork.isAvailable && (
          <p className="text-sm text-zinc-600 mt-1 tracking-wider uppercase text-xs">Sold</p>
        )}
      </div>
    </Link>
  );
}
