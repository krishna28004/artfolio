import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

/**
 * Computes a privacy-preserving SHA-256 hash of the client IP address.
 * Never stores or logs raw IP addresses.
 */
function hashClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const rawIp = forwarded ? forwarded.split(",")[0].trim() : req.headers.get("x-real-ip") || "127.0.0.1";
  const salt = process.env.VIEW_TELEMETRY_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "artfolio-telemetry-salt";
  return crypto.createHash("sha256").update(`${rawIp}:${salt}`).digest("hex");
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const artworkId = params.id;
    const supabase = getSupabaseAdmin();

    const { count, error } = await supabase
      .from("artwork_views")
      .select("*", { count: "exact", head: true })
      .eq("artwork_id", artworkId);

    if (error) {
      console.warn("[TELEMETRY_GET_ERROR] Failed to fetch count:", error);
      return NextResponse.json({ success: false, views: 0 }, { status: 200 });
    }

    return NextResponse.json({ success: true, views: count || 0 });
  } catch (error) {
    console.error("[TELEMETRY_GET_FATAL]", error);
    return NextResponse.json({ success: false, views: 0 }, { status: 200 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const artworkId = params.id;
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
  } catch (error) {
    console.warn("[TELEMETRY_RECORD_ERROR] View recording failed safely:", error);
    return NextResponse.json({ success: false, views: null }, { status: 200 });
  }
}
