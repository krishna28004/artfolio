import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";

import { CommissionStatus } from "@/types/supabase";

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      const legacyKey = process.env.ADMIN_API_KEY;
      const authHeader = req.headers.get("authorization") || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!legacyKey || bearerToken !== legacyKey) {
        return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
      }
    }

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
      console.error("[ADMIN_COMMISSIONS_GET_ERROR]", error);
      return NextResponse.json({ success: false, message: "Failed to fetch commissions." }, { status: 500 });
    }

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (error) {
    console.error("[ADMIN_COMMISSIONS_GET_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
