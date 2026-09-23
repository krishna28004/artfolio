import { getSupabase } from "@/shared/services/supabase";
import { artworks as staticArtworks, Artwork } from "@/features/artwork/data/artworks";
import type { Database } from "@/types/supabase";

type DbArtwork = Database["public"]["Tables"]["artworks"]["Row"];

/**
 * Maps a Supabase database artwork row to the frontend Artwork domain model.
 */
export function mapDbArtworkToDomain(dbArt: DbArtwork): Artwork {
  return {
    id: dbArt.id,
    title: dbArt.title,
    artist: dbArt.artist || "Krishna Kumar",
    year: dbArt.year || (dbArt.created_at ? new Date(dbArt.created_at).getFullYear() : 2024),
    description: dbArt.description || "",
    imageUrl: dbArt.image_url,
    thumbnailUrl: dbArt.thumbnail_url || undefined,
    medium: dbArt.medium || "Pencil on Paper",
    dimensions: dbArt.dimensions || "A3 Sheet",
    price: dbArt.price || undefined,
    category: dbArt.category || undefined,
    isAvailable: dbArt.is_available,
    position3D: Array.isArray(dbArt.position_3d) ? (dbArt.position_3d as [number, number, number]) : undefined,
    rotation3D: Array.isArray(dbArt.rotation_3d) ? (dbArt.rotation_3d as [number, number, number]) : undefined,
    wallIdentifier: dbArt.wall_identifier || undefined,
  };
}

/**
 * Retrieves all published artworks from Supabase PostgreSQL.
 * Single source of truth for the entire application.
 * Falls back safely to the verified seed catalog if the database is unreachable.
 */
export async function getAllArtworks(): Promise<Artwork[]> {
  try {
    const supabase = getSupabase();
    const { data: dbArtworks, error } = await supabase
      .from("artworks")
      .select("*")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (!error && dbArtworks && dbArtworks.length > 0) {
      return dbArtworks.map(mapDbArtworkToDomain);
    }
  } catch (err) {
    console.warn("[ARTWORK_SERVICE] Supabase query failed, falling back to static catalog:", err);
  }

  // Graceful fallback for offline dev/initial build
  return staticArtworks;
}

/**
 * Retrieves a single artwork by its unique slug/ID.
 */
export async function getArtworkById(id: string): Promise<Artwork | null> {
  try {
    const supabase = getSupabase();
    const { data: dbArt, error } = await supabase
      .from("artworks")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && dbArt) {
      return mapDbArtworkToDomain(dbArt);
    }
  } catch (err) {
    console.warn(`[ARTWORK_SERVICE] Lookup failed for '${id}', falling back:`, err);
  }

  const fallback = staticArtworks.find((a) => a.id === id);
  return fallback || null;
}
