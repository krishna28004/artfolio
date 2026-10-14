"use client";

import { useState } from "react";
import Image from "next/image";

interface ArtworkDisplayProps {
  title: string;
  imageUrl: string;
  imageUrls?: string[];
}

export function ArtworkDisplay({ title, imageUrl, imageUrls }: ArtworkDisplayProps) {
  const images = imageUrls?.length ? imageUrls : [imageUrl];
  const [selected, setSelected] = useState(Math.max(0, images.indexOf(imageUrl)));
  const current = images[selected] || imageUrl;

  return (
    <div className="space-y-4">
      <div className="relative w-full h-[60vh] md:h-[80vh] lg:h-[85vh] bg-[#050505] border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
        <Image src={current} alt={`${title}, image ${selected + 1} of ${images.length}`} fill
          sizes="(max-width: 1024px) 100vw, 60vw" className="object-contain p-4 md:p-8" priority={selected === 0} />
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
