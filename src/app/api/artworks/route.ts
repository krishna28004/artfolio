import { NextRequest, NextResponse } from "next/server";
import { getArtworkCatalog } from "@/features/artwork/services/artwork-service";
import { getMuseumSlot } from "@/features/artwork/data/museum-slots";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

export const dynamic = "force-dynamic";
const unavailable = () => NextResponse.json(
  { success: false, code: "CATALOG_UNAVAILABLE", message: "The artwork collection is temporarily unavailable." },
  { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } },
);

export async function GET(req: NextRequest) {
  const catalog = await getArtworkCatalog();
  if (catalog.status === "unavailable") return unavailable();
  let artworks = catalog.artworks;
  let exhibitionPublished = true;
  if (req.nextUrl.searchParams.get("exhibition") === "1" && catalog.schema === "publication") {
    try {
      const { data, error } = await getSupabaseAdmin().from("exhibition_settings")
        .select("is_published").eq("id", "main").maybeSingle();
      if (error || !data) {
        console.error("[EXHIBITION_STATE_ERROR]", { code: error?.code || "SETTING_MISSING" });
        return unavailable();
      }
      exhibitionPublished = data.is_published;
      artworks = exhibitionPublished ? artworks.filter((art) => !!getMuseumSlot(art.wallIdentifier)) : [];
    } catch {
      console.error("[EXHIBITION_STATE_ERROR]", { code: "CONFIGURATION_UNAVAILABLE" });
      return unavailable();
    }
  }
  return NextResponse.json({ success: true, count: artworks.length, data: artworks, schema: catalog.schema, exhibitionPublished });
}
