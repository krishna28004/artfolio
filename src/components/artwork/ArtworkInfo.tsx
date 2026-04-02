interface ArtworkInfoProps {
  title: string;
  artist: string;
  year: string;
  medium?: string;
  dimensions?: string;
  description: string;
}

export function ArtworkInfo({ title, artist, year, medium, dimensions, description }: ArtworkInfoProps) {
  return (
    <div className="flex flex-col h-full justify-center">
      
      {/* Editorial Header Array */}
      <div className="mb-10">
        <h1 className="font-serif text-[40px] md:text-[56px] text-text leading-[1.1] tracking-[-0.02em] mb-4">
          {title}
        </h1>
        <div className="flex items-center gap-3 font-sans text-[14px] text-muted tracking-[0.15em] uppercase">
          <span className="text-text/80 font-medium">{artist}</span>
          <span className="w-1 h-1 rounded-full bg-accent/50"></span>
          <span>{year}</span>
        </div>
      </div>

      {/* Archival Metadata */}
      {(medium || dimensions) && (
        <div className="flex flex-col gap-1 mb-8 font-sans text-[13px] text-muted/60 uppercase tracking-widest">
          {medium && <span>{medium}</span>}
          {dimensions && <span>{dimensions}</span>}
        </div>
      )}

      {/* Curatorial Context */}
      <p className="font-sans text-[16px] text-muted/80 leading-[1.8] font-light max-w-md mb-12">
        {description}
      </p>

      {/* Singular Ghost CTA */}
      <div className="mt-auto">
        <button className="px-12 py-4 border border-text/20 text-text uppercase text-[13px] tracking-[0.1em] font-medium transition-all duration-[600ms] hover:border-text hover:text-accent">
          Inquire About Piece
        </button>
      </div>

    </div>
  );
}
