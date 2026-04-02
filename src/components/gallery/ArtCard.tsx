import Image from "next/image";
import Link from "next/link";

interface ArtCardProps {
  id: string;
  title: string;
  artist: string;
  year: string;
  imageUrl: string;
  index: number;
}

export function ArtCard({ id, title, artist, year, imageUrl, index }: ArtCardProps) {
  // 1. RHYTHM: Stagger the middle column down to break the rigid horizontal line
  const isMiddleColumn = index % 3 === 1;
  const rhythmOffset = isMiddleColumn ? "lg:translate-y-12" : "";

  return (
    <Link href={`/artwork/${id}`} className={`group flex flex-col`}>
      
        {/* Subtle depth: extremely soft, barely-there shadow (not heavy UI-like). 
            Minimal hover: gentle opacity drop on hover with a slow custom ease curve down to 85% */}
      <div className="relative w-full aspect-[4/5] bg-[#0A0A0A] border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden transition-opacity duration-[800ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:opacity-85">
        <Image 
          src={imageUrl} 
          alt={title} 
          fill 
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover object-center"
        />
      </div>

      {/* Typography hierarchy: 
          - title prominent but not screaming 
          - greater spacing before metadata
          - metadata is subdued and widely tracked */}
      <div className="mt-5 flex flex-col px-1">
        <h3 className="font-serif text-[18px] md:text-[20px] text-text/90 transition-colors duration-500 group-hover:text-accent">
          {title}
        </h3>
        <p className="font-sans text-[12px] md:text-[13px] text-muted/50 mt-2 uppercase tracking-[0.15em] font-medium">
          {artist}  {year}
        </p>
      </div>
    </Link>
  );
}
