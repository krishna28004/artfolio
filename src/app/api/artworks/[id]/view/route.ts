import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getClientIp } from "@/shared/utils/rate-limit";
import { getArtworkById } from "@/features/artwork/services/artwork-service";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

/**
 * Computes a privacy-preserving SHA-256 hash of the client IP address.
 * Never stores or logs raw IP addresses.
 */
function hashClientIp(req: NextRequest): string {
  const salt = process.env.TELEMETRY_SALT || process.env.VIEW_TELEMETRY_SALT;
  if (!salt && process.env.NODE_ENV === "production") throw new Error("Telemetry recording is unavailable.");
  return crypto.createHmac("sha256", salt || "local-fixture-only").update(getClientIp(req)).digest("hex");
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const artworkId = params.id;
    if (!(await getArtworkById(artworkId))) return NextResponse.json({ success: false, message: "Artwork unavailable." }, { status: 404 });
    const supabase = getSupabaseAdmin();

    const { count, error } = await supabase
      .from("artwork_views")
      .select("*", { count: "exact", head: true })
      .eq("artwork_id", artworkId);

    if (error) {
      console.warn("[TELEMETRY_GET_ERROR]");
      return NextResponse.json({ success: false, views: 0 }, { status: 200 });
    }

    return NextResponse.json({ success: true, views: count || 0 });
  } catch {
    console.error("[TELEMETRY_GET_FATAL]");
    return NextResponse.json({ success: false, views: 0 }, { status: 200 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await Promise.resolve(context.params);
    const artworkId = params.id;
    if (!(await getArtworkById(artworkId))) return NextResponse.json({ success: false, message: "Artwork unavailable." }, { status: 404 });
    const ipHash = hashClientIp(req);
    const supabase = getSupabaseAdmin();

    // 24-hour deduplication window: check if this IP hash viewed this artwork recently
    const dedupeWindow = new Date();
    dedupeWindow.setHours(dedupeWindow.getHours() - 24);

    const { data: recentView } = await supabase
      .from("artwork_views")
      .select("id")
      .eq("artwork_id", artworkId)
      .eq("ip_hash", ipHash)
      .gte("viewed_at", dedupeWindow.toISOString())
      .limit(1)
      .maybeSingle();

    if (!recentView) {
      // Record authentic view
      await supabase.from("artwork_views").insert({
        artwork_id: artworkId,
        ip_hash: ipHash,
      });
    }

    // Get authoritative count
    const { count } = await supabase
      .from("artwork_views")
      .select("*", { count: "exact", head: true })
      .eq("artwork_id", artworkId);

    return NextResponse.json({
      success: true,
      views: count || 0,
      recorded: !recentView,
    });
  } catch {
    console.warn("[TELEMETRY_RECORD_ERROR]");
    return NextResponse.json({ success: false, views: null }, { status: 200 });
  }
}
