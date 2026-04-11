import { Section } from "@/components/layout/Section";
import { ArtGrid } from "@/components/gallery/ArtGrid";
import { ArtCard } from "@/components/gallery/ArtCard";
import { Artwork } from "@/features/artwork/data/artworks";

interface GalleryProps {
  artworks: Artwork[];
}

export function Gallery({ artworks }: GalleryProps) {
  return (
    <Section className="pt-8 pb-32" id="gallery">

      <div className="mb-14 flex flex-col items-center text-center max-w-2xl mx-auto">
        <h2 className="font-serif text-[40px] md:text-[56px] text-text tracking-[-0.03em] leading-tight mb-4">
          Selected Works
        </h2>
        <div className="w-12 h-px bg-primary/50"></div>
      </div>

      {artworks.length > 0 ? (
        <ArtGrid>
          {artworks.map((art, index) => (
            <ArtCard
              key={art.id}
              artwork={art}
              index={index}
            />
          ))}
        </ArtGrid>
      ) : (
        <div className="text-center py-20 bg-zinc-900/10 rounded-3xl border border-dashed border-zinc-800">
          <p className="text-zinc-500 font-serif italic">The curator is currently selecting new works for the collection.</p>
        </div>
      )}

    </Section>
  );
}
