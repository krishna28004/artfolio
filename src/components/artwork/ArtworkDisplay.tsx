"use client";

import { useState } from "react";
import { ArtworkScribbleLoader } from "@/components/artwork/ArtworkScribbleLoader";
import Image from "next/image";

interface ArtworkDisplayProps {
  title: string;
  imageUrl: string;
  imageUrls?: string[];
  thumbnailUrl?: string;
}

export function ArtworkDisplay({ title, imageUrl, imageUrls, thumbnailUrl }: ArtworkDisplayProps) {
  const images = imageUrls?.length ? imageUrls : [imageUrl];
  const [selected, setSelected] = useState(Math.max(0, images.indexOf(imageUrl)));
  const current = images[selected] || imageUrl;
  const [loadState, setLoadState] = useState<{ src: string; status: "loaded" | "failed" } | null>(null);
  const loaded = loadState?.src === current && loadState.status === "loaded";
  const failed = loadState?.src === current && loadState.status === "failed";

  return (
    <div className="space-y-4">
      <div className="relative w-full h-[60vh] md:h-[80vh] lg:h-[85vh] bg-[#050505] border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
        {selected === 0 && thumbnailUrl && thumbnailUrl !== current && (
          <Image src={thumbnailUrl} alt="" fill sizes="(max-width: 1024px) 100vw, 60vw" className="object-contain p-4 md:p-8" priority />
        )}
        <Image key={current} src={current} alt={`${title}, image ${selected + 1} of ${images.length}`} fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className={`object-contain p-4 md:p-8 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          priority={selected === 0}
          onLoad={() => setLoadState({ src: current, status: "loaded" })}
          onError={() => setLoadState({ src: current, status: "failed" })} />
        {!loaded && !failed && <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/15"><ArtworkScribbleLoader label="Loading full-resolution artwork" /></div>}
        {failed && <div role="status" className="absolute inset-x-4 bottom-4 z-10 bg-black/80 px-4 py-3 text-center text-sm text-muted">The artwork image could not be loaded. Its description and details are still available.</div>}
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted">Image {selected + 1} of {images.length}</p>
        <a href={current} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline focus-visible:outline-2 focus-visible:outline-primary">View full size</a>
      </div>
      {images.length > 1 && <div className="flex flex-wrap gap-3" aria-label="Artwork image gallery">
        {images.map((url, index) => <button key={`${url}-${index}`} type="button" onClick={() => setSelected(index)}
          aria-label={`Show image ${index + 1} of ${images.length}`} aria-pressed={selected === index}
          className={`relative h-20 w-20 border focus-visible:outline-2 focus-visible:outline-primary ${selected === index ? "border-primary" : "border-white/20"}`}>
          <Image src={url} alt="" fill sizes="80px" className="object-cover" />
        </button>)}
      </div>}
    </div>
  );
}
