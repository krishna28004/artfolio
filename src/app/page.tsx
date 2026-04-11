import { Hero } from "@/components/blocks/Hero";
import { Gallery } from "@/components/blocks/Gallery";
import { About } from "@/components/blocks/About";
import { createClient } from "@/utils/supabase/server";
import { artworks as staticArtworks, Artwork } from "@/features/artwork/data/artworks";

export default async function Home() {
  let finalArtworks = staticArtworks;

  try {
    const supabase = await createClient();

    const { data: dbArtworks, error } = await supabase
      .from("artworks")
      .select("*")
      .order("created_at", { ascending: false });

    // Only use DB data if query succeeded and returned results
    if (!error && dbArtworks && dbArtworks.length > 0) {
      finalArtworks = dbArtworks.map((art) => ({
        id: art.id,
        title: art.title,
        artist: "Krishna Kumar",
        year: art.created_at ? new Date(art.created_at).getFullYear() : 2024,
        description: art.description || "",
        imageUrl: art.image_url,
        medium: art.medium || "Pencil on Paper",
        dimensions: art.dimensions || "A3 Sheet",
        price: art.price || undefined,
        isAvailable: true,
      }));
    }
    // Silently fall back to static data if table doesn't exist yet
  } catch {
    // Supabase not reachable or table missing — use static artworks
  }

  return (
    <div className="flex-1 flex flex-col">
      <Hero />
      <Gallery artworks={finalArtworks} />
      <About />
    </div>
  );
}