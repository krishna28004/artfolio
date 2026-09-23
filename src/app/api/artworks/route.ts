import { NextResponse } from "next/server";
import { getAllArtworks } from "@/features/artwork/services/artwork-service";

export const revalidate = 60; // Revalidate every 60 seconds

export async function GET() {
  try {
    const artworks = await getAllArtworks();
    return NextResponse.json({ success: true, count: artworks.length, data: artworks });
  } catch (error) {
    console.error("[API_ARTWORKS_ERROR]", error);
    return NextResponse.json({ success: false, message: "Failed to retrieve artworks." }, { status: 500 });
  }
}
