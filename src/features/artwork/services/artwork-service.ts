import { getSupabase } from "@/shared/services/supabase";
import { artworks as staticArtworks } from "@/features/artwork/data/artworks";
import type { Artwork } from "@/features/artwork/data/artworks";
import { isValid3DPosition, isValid3DRotation } from "@/features/artwork/utils/exhibition-validation";
import { getMuseumSlot } from "@/features/artwork/data/museum-slots";
import type { Database } from "@/types/supabase";

type DbArtwork = Database["public"]["Tables"]["artworks"]["Row"];
type CatalogRow = Omit<DbArtwork, "publication_status" | "sale_status" | "image_urls" | "draft_wall_identifier"> & {
  publication_status?: "draft" | "published" | "archived";
  sale_status?: "available" | "reserved" | "sold" | "not_for_sale";
  image_urls?: string[];
};
export type CatalogSchema = "legacy_public" | "publication";
export type CatalogResult =
  | { status: "available" | "empty"; schema: CatalogSchema; artworks: Artwork[] }
  | { status: "unavailable"; schema: null; artworks: []; diagnostic: string };

export class ArtworkCatalogError extends Error {
  readonly diagnostic: string;
  constructor(diagnostic: string) {
    super("The artwork collection is temporarily unavailable.");
    this.name = "ArtworkCatalogError";
    this.diagnostic = diagnostic;
  }
}

function fail(operation: string, cause: unknown): never {
  const rawCode = typeof cause === "object" && cause !== null && "code" in cause ? cause.code : null;
  const code = typeof rawCode === "string" && /^[A-Z0-9_]{1,40}$/.test(rawCode) ? rawCode : "UNAVAILABLE";
  // Never log provider messages/details, credentials, URLs or visitor input.
  console.error("[ARTWORK_CATALOG_ERROR]", { operation, code });
  throw new ArtworkCatalogError(code);
}

const publicColumns = "id,title,artist,year,description,image_url,thumbnail_url,texture_url,medium,dimensions,price,category,is_available,is_featured,display_order,position_3d,rotation_3d,wall_identifier,created_at,updated_at";
const catalogColumns = (schema: CatalogSchema) => schema === "publication"
  ? publicColumns + ",publication_status,sale_status,image_urls" : publicColumns;
let legacyWarningShown = false;
async function catalogSchema(): Promise<CatalogSchema> {
  // Probe exactly one optional column. Only its undefined-column SQL code permits
  // the original public schema; network, permissions and missing-table errors do not.
  const { error } = await getSupabase().from("artworks")
    .select("publication_status").limit(0);
  if (!error) return "publication";
  if (error.code !== "42703") fail("schema_probe", error);
  if (!legacyWarningShown) {
    console.warn("[ARTWORK_CATALOG_LEGACY_SCHEMA] Existing anonymous public catalog is in use; rehearse the publication migration before enabling drafts.");
    legacyWarningShown = true;
  }
  return "legacy_public";
}

function visibleRows(rows: CatalogRow[], schema: CatalogSchema): CatalogRow[] {
  const carriesPublication = rows.some((row) => Object.hasOwn(row, "publication_status"));
  if (schema === "publication" || carriesPublication) {
    if (rows.some((row) => !Object.hasOwn(row, "publication_status") ||
      !["published", "draft", "archived"].includes(row.publication_status || ""))) {
      fail("publication_response", { code: "SCHEMA_MISMATCH" });
    }
    // Defense in depth for a migration that completes between probe and SELECT.
    return rows.filter((row) => row.publication_status === "published");
  }
  return rows;
}

/** Map only a persisted visible row. Static data supplies legacy geometry/texture,
 * never a substitute catalog record, price, publication decision or empty state. */
export function mapDbArtworkToDomain(dbArt: CatalogRow): Artwork {
  const staticMatch = staticArtworks.find((s) => s.id === dbArt.id);
  const slot = getMuseumSlot(dbArt.wall_identifier);
  const legacyGeometry = Object.hasOwn(dbArt, "publication_status") ? undefined : staticMatch;
  const position3D = slot?.position || (
    Array.isArray(dbArt.position_3d) && isValid3DPosition(dbArt.position_3d)
      ? dbArt.position_3d as [number, number, number] : legacyGeometry?.position3D);
  const rotation3D = slot?.rotation || (
    Array.isArray(dbArt.rotation_3d) && isValid3DRotation(dbArt.rotation_3d)
      ? dbArt.rotation_3d as [number, number, number] : legacyGeometry?.rotation3D);
  const saleStatus = dbArt.sale_status || (dbArt.is_available ? "available" : "not_for_sale");
  return {
    id: dbArt.id, title: dbArt.title, artist: dbArt.artist || "Krishna Kumar",
    year: dbArt.year || (dbArt.created_at ? new Date(dbArt.created_at).getFullYear() : 2024),
    description: dbArt.description || "", imageUrl: dbArt.image_url,
    imageUrls: dbArt.image_urls?.length ? dbArt.image_urls : [dbArt.image_url],
    thumbnailUrl: dbArt.thumbnail_url || undefined,
    textureUrl: dbArt.texture_url || (dbArt.image_url === staticMatch?.imageUrl ? staticMatch?.textureUrl : undefined) || dbArt.image_url,
    medium: dbArt.medium || "Pencil on Paper", dimensions: dbArt.dimensions || "A3 Sheet",
    price: dbArt.price || undefined, category: dbArt.category || undefined,
    isAvailable: saleStatus === "available", saleStatus,
    position3D, rotation3D, wallIdentifier: dbArt.wall_identifier || legacyGeometry?.wallIdentifier || undefined,
  };
}

export async function getArtworkCatalog(): Promise<CatalogResult> {
  try {
    const schema = await catalogSchema();
    let query = getSupabase().from("artworks").select(catalogColumns(schema));
    if (schema === "publication") query = query.eq("publication_status", "published");
    const { data, error } = await query.order("display_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) fail("collection_read", error);
    if (!Array.isArray(data)) fail("collection_response", { code: "INVALID_RESPONSE" });
    const artworks = visibleRows(data as unknown as CatalogRow[], schema).map(mapDbArtworkToDomain);
    return { status: artworks.length ? "available" : "empty", schema, artworks };
  } catch (error) {
    if (error instanceof ArtworkCatalogError) return { status: "unavailable", schema: null, artworks: [], diagnostic: error.diagnostic };
    console.error("[ARTWORK_CATALOG_ERROR]", { operation: "configuration_or_network", code: "UNAVAILABLE" });
    return { status: "unavailable", schema: null, artworks: [], diagnostic: "UNAVAILABLE" };
  }
}

export async function getAllArtworks(): Promise<Artwork[]> {
  const catalog = await getArtworkCatalog();
  if (catalog.status === "unavailable") throw new ArtworkCatalogError(catalog.diagnostic);
  return catalog.artworks;
}

export async function getArtworkById(id: string): Promise<Artwork | null> {
  try {
    const schema = await catalogSchema();
    let query = getSupabase().from("artworks").select(catalogColumns(schema)).eq("id", id);
    if (schema === "publication") query = query.eq("publication_status", "published");
    const { data, error } = await query.maybeSingle();
    if (error) fail("detail_read", error);
    if (!data) return null;
    const visible = visibleRows([data as unknown as CatalogRow], schema);
    return visible.length ? mapDbArtworkToDomain(visible[0]) : null;
  } catch (error) {
    if (error instanceof ArtworkCatalogError) throw error;
    fail("detail_configuration_or_network", error);
  }
}
