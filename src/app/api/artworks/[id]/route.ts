import { NextRequest, NextResponse } from "next/server";
import { getArtworkById } from "@/features/artwork/services/artwork-service";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const artwork = await getArtworkById(params.id);

    if (!artwork) {
      return NextResponse.json({ success: false, message: "Artwork not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: artwork });
  } catch {
    return NextResponse.json({ success: false, message: "Failed to retrieve artwork." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}
