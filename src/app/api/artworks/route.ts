import { NextRequest, NextResponse } from "next/server";
import { getAllArtworks } from "@/features/artwork/services/artwork-service";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { getMuseumSlot } from "@/features/artwork/data/museum-slots";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    if (req.nextUrl.searchParams.get("exhibition") === "1") {
      const { data: settings, error: settingsError } = await getSupabaseAdmin()
        .from("exhibition_settings").select("is_published").eq("id", "main").maybeSingle();
      if (settingsError || !settings) {
        return NextResponse.json({ success: false, message: "Exhibition state is unavailable." }, { status: 503 });
      }
      if (!settings.is_published) return NextResponse.json({ success: true, count: 0, data: [] });
      const artworks = (await getAllArtworks()).filter((art) => !!getMuseumSlot(art.wallIdentifier));
      return NextResponse.json({ success: true, count: artworks.length, data: artworks });
    }
    const artworks = await getAllArtworks();
    return NextResponse.json({ success: true, count: artworks.length, data: artworks });
  } catch (error) {
    console.error("[API_ARTWORKS_ERROR]", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve artworks." }, { status: 500 });
  }
}
