import { getSupabase } from "@/shared/services/supabase";
import { artworks as staticArtworks } from "@/features/artwork/data/artworks";
import type { Artwork } from "@/features/artwork/data/artworks";
import { isValid3DPosition, isValid3DRotation } from "@/features/artwork/utils/exhibition-validation";
import type { Database } from "@/types/supabase";
import { getMuseumSlot } from "@/features/artwork/data/museum-slots";

type DbArtwork = Database["public"]["Tables"]["artworks"]["Row"];

/**
 * Maps a Supabase database artwork row to the frontend Artwork domain model.
 * If 3D exhibition coordinates are missing or invalid in DB, merges curated spatial placement.
 */
export function mapDbArtworkToDomain(dbArt: DbArtwork): Artwork {
  const staticMatch = staticArtworks.find((s) => s.id === dbArt.id);
  const museumSlot = getMuseumSlot(dbArt.wall_identifier);

  const position3D =
    museumSlot?.position || (Array.isArray(dbArt.position_3d) && isValid3DPosition(dbArt.position_3d)
      ? (dbArt.position_3d as [number, number, number])
      : undefined);

  const rotation3D =
    museumSlot?.rotation || (Array.isArray(dbArt.rotation_3d) && isValid3DRotation(dbArt.rotation_3d)
      ? (dbArt.rotation_3d as [number, number, number])
      : undefined);

  return {
    id: dbArt.id,
    title: dbArt.title,
    artist: dbArt.artist || "Krishna Kumar",
    year: dbArt.year || (dbArt.created_at ? new Date(dbArt.created_at).getFullYear() : 2024),
    description: dbArt.description || "",
    imageUrl: dbArt.image_url,
    imageUrls: dbArt.image_urls?.length ? dbArt.image_urls : [dbArt.image_url],
    thumbnailUrl: dbArt.thumbnail_url || undefined,
    textureUrl: dbArt.texture_url || staticMatch?.textureUrl || dbArt.image_url,
    medium: dbArt.medium || "Pencil on Paper",
    dimensions: dbArt.dimensions || "A3 Sheet",
    price: dbArt.price || undefined,
    category: dbArt.category || undefined,
    isAvailable: dbArt.sale_status ? dbArt.sale_status === "available" : dbArt.is_available,
    saleStatus: dbArt.sale_status || (dbArt.is_available ? "available" : "not_for_sale"),
    position3D,
    rotation3D,
    wallIdentifier: dbArt.wall_identifier || undefined,
  };
}

/**
 * Retrieves all published artworks from Supabase PostgreSQL.
 * Single source of truth for the entire application.
 * Uses seed data only in development. Production database failures and an empty
 * catalog stay empty so visitors never see invented or stale portfolio records.
 */
export async function getAllArtworks(): Promise<Artwork[]> {
  try {
    const supabase = getSupabase();
    const { data: dbArtworks, error } = await supabase
      .from("artworks")
      .select("*")
      .eq("publication_status", "published")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (dbArtworks || []).map(mapDbArtworkToDomain);
  } catch (err) {
    console.warn("[ARTWORK_SERVICE] Supabase query failed.", err instanceof Error ? err.message : "unknown error");
    if (process.env.NODE_ENV === "production") return [];
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
      .eq("publication_status", "published")
      .maybeSingle();

    if (!error) return dbArt ? mapDbArtworkToDomain(dbArt) : null;
  } catch (err) {
    console.warn(`[ARTWORK_SERVICE] Artwork lookup failed for '${id}'.`, err instanceof Error ? err.message : "unknown error");
  }

  if (process.env.NODE_ENV === "production") return null;
  const fallback = staticArtworks.find((a) => a.id === id);
  return fallback || null;
}
