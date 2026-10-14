import { logSecurityFailure } from "@/shared/utils/security-log";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";

import type { CommissionStatus } from "@/types/supabase";

export async function GET(req: NextRequest) {
  try {
    const bootstrap = req.nextUrl.searchParams.get("status") === "auth";
    const authResult = await verifyAdminAuth(req, { requireMfa: !bootstrap });
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.error || "Unauthorized administrative clearance." },
        { status: 401 }
      );
    }

    if (bootstrap) return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("commissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status as CommissionStatus);
    }

    const { data, error } = await query;

    if (error) {
      logSecurityFailure("[ADMIN_COMMISSIONS_GET_ERROR]", error);
      return NextResponse.json({ success: false, message: "Failed to fetch commissions." }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    logSecurityFailure("[ADMIN_COMMISSIONS_GET_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
