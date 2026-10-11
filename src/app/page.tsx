import { HeroCarousel } from "@/components/blocks/HeroCarousel";
import { Gallery } from "@/components/blocks/Gallery";
import { About } from "@/components/blocks/About";
import { getAllArtworks } from "@/features/artwork/services/artwork-service";

// Enable Incremental Static Regeneration (ISR) so admin CMS artwork updates
// refresh within 60 seconds without requiring a full redeployment.
export const revalidate = 60;

export default async function Home() {
  const artworks = await getAllArtworks();

  return (
    <div className="flex-1 flex flex-col">
      <HeroCarousel artworks={artworks} />
      <Gallery artworks={artworks} />
      <About />
    </div>
  );
}
