import { Section } from "@/components/layout/Section";
import { ArtGrid } from "@/components/gallery/ArtGrid";
import { ArtCard } from "@/components/gallery/ArtCard";

import { placeholders } from "@/lib/data/placeholders";

export function Gallery() {
  return (
    // Reduced excessive vertical spacing (pt-12 instead of pt-24) to bring it closer to the hero
    <Section className="pt-8 pb-32" id="gallery">

      {/* Increased prominence of the section header */}
      <div className="mb-14 flex flex-col items-center text-center max-w-2xl mx-auto">
        <h2 className="font-serif text-[40px] md:text-[56px] text-text tracking-[-0.03em] leading-tight mb-4">
          Selected Works
        </h2>
        <div className="w-12 h-px bg-primary/50"></div>
      </div>

      <ArtGrid>
        {placeholders.map((art, index) => (
          <ArtCard
            key={art.id}
            artwork={art}
            index={index}
          />
        ))}
      </ArtGrid>

    </Section>
  );
}
