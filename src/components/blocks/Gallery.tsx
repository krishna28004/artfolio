import { Section } from "@/components/layout/Section";
import { ArtGrid } from "@/components/gallery/ArtGrid";
import { ArtCard } from "@/components/gallery/ArtCard";

// Controlled mock data
const artworks = [
  { id: "1", title: "Obsidian Echoes", artist: "E. Thorne", year: "2024", url: "/featured-artwork.png" },
  { id: "2", title: "Golden Void", artist: "A. Mercer", year: "2023", url: "/featured-artwork.png" },
  { id: "3", title: "Vanta Sequence", artist: "E. Thorne", year: "2024", url: "/featured-artwork.png" },
];

export function Gallery() {
  return (
    // Reduced excessive vertical spacing (pt-12 instead of pt-24) to bring it closer to the hero
    <Section className="pt-12 pb-24 border-t border-white/5">
      
      {/* Increased prominence of the section header */}
      <div className="mb-14 flex flex-col items-center text-center max-w-2xl mx-auto">
        <h2 className="font-serif text-[40px] md:text-[56px] text-text tracking-[-0.03em] leading-tight mb-4">
          Selected Works
        </h2>
        <div className="w-12 h-px bg-accent/50"></div>
      </div>

      <ArtGrid>
        {artworks.map((art, index) => (
          <ArtCard 
            key={art.id}
            id={art.id}
            title={art.title}
            artist={art.artist}
            year={art.year}
            imageUrl={art.url}
            index={index}
          />
        ))}
      </ArtGrid>

    </Section>
  );
}
