import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { isCommissionReleaseEnabled } from "@/shared/utils/release-controls";

const schema = z.object({ acceptingRequests: z.boolean() });

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ success: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const { data, error } = await getSupabaseAdmin().from("commission_intake_settings")
      .select("accepting_requests").eq("id", 1).maybeSingle();
    if (error || !data) return NextResponse.json({ success: false, message: "Availability setting is unavailable; intake remains closed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ success: true, acceptingRequests: data.accepting_requests,
      releaseEnabled: isCommissionReleaseEnabled() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, message: "Availability setting is unavailable; intake remains closed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ success: false, message: "Owner access required." }, { status: 401 });
  const origin = req.headers.get("origin");
  if (auth.source === "session" && origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid availability setting." }, { status: 400 });
  if (parsed.data.acceptingRequests && !isCommissionReleaseEnabled()) {
    return NextResponse.json({ success: false, message: "The deployment release gate is closed. Intake cannot be opened." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const { data, error } = await getSupabaseAdmin().rpc("set_commission_intake_enabled", {
      p_enabled: parsed.data.acceptingRequests, p_actor: auth.userEmail || "owner",
    });
    if (error || data !== parsed.data.acceptingRequests) {
      return NextResponse.json({ success: false, message: "Availability could not be saved." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ success: true, acceptingRequests: data, releaseEnabled: isCommissionReleaseEnabled() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ success: false, message: "Availability could not be saved." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
