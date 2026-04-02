import Image from "next/image";

interface ArtworkDisplayProps {
  title: string;
  imageUrl: string;
}

export function ArtworkDisplay({ title, imageUrl }: ArtworkDisplayProps) {
  return (
    // Added group and cursor-zoom-in for physical interaction affordance
    <div className="group relative w-full h-[60vh] md:h-[80vh] lg:h-[85vh] bg-[#050505] border border-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden cursor-zoom-in">
      {/* Implemented an ultra-slow 1.2s cubic-bezier scale breath */}
      <Image 
        src={imageUrl} 
        alt={title} 
        fill 
        sizes="(max-width: 1024px) 100vw, 60vw"
        className="object-contain p-4 md:p-8 transition-transform duration-[1200ms] ease-[cubic-bezier(0.25,1,0.5,1)] group-hover:scale-[1.02]"
        priority
      />
    </div>
  );
}
