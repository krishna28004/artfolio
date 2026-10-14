import { HeroCarousel } from "@/components/blocks/HeroCarousel";
import { Gallery } from "@/components/blocks/Gallery";
import { About } from "@/components/blocks/About";
import { getArtworkCatalog } from "@/features/artwork/services/artwork-service";

export const revalidate = 60;

export default async function Home() {
  const catalog = await getArtworkCatalog();
  return (
    <div className="flex-1 flex flex-col">
      <HeroCarousel artworks={catalog.artworks} />
      <Gallery artworks={catalog.artworks} catalogUnavailable={catalog.status === "unavailable"} />
      <About />
    </div>
  );
}
