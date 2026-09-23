import { Hero } from "@/components/blocks/Hero";
import { Gallery } from "@/components/blocks/Gallery";
import { About } from "@/components/blocks/About";
import { getAllArtworks } from "@/features/artwork/services/artwork-service";

export default async function Home() {
  const artworks = await getAllArtworks();

  return (
    <div className="flex-1 flex flex-col">
      <Hero />
      <Gallery artworks={artworks} />
      <About />
    </div>
  );
}