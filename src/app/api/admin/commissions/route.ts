import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";

import type { CommissionStatus } from "@/types/supabase";

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(req, { requireMfa: req.nextUrl.searchParams.get("status") !== "auth" });
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.error || "Unauthorized administrative clearance." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    if (status === "auth") {
      return NextResponse.json({ success: true, authorized: true }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const supabaseAdmin = getSupabaseAdmin();
    if (status === "metrics") {
      const { data: metrics, error: metricsError } = await supabaseAdmin.rpc("commission_business_metrics");
      if (metricsError || !metrics) {
        return NextResponse.json({ success: false, message: "Business metrics unavailable." }, { status: 503 });
      }
      return NextResponse.json({ success: true, data: metrics }, { headers: { "Cache-Control": "private, no-store" } });
    }
    let query = supabaseAdmin
      .from("commissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (status && status !== "all") {
      query = query.eq("status", status as CommissionStatus);
    }

    const [{ data, error }, { data: unread, error: unreadError }] = await Promise.all([
      query, supabaseAdmin.rpc("commission_unread_counts"),
    ]);

    if (error || unreadError || !unread) {
      console.error("[ADMIN_COMMISSIONS_GET_ERROR]", error);
      return NextResponse.json({ success: false, message: "Failed to fetch commissions." }, { status: 500 });
    }

    const unreadById = new Map(unread.map((item) => [item.commission_id, Number(item.unread_count)]));
    const visible = (data || []).map((commission) => {
      const { tracking_token_hash: _trackingHash, checkout_token_hash: _checkoutHash,
        tracking_nonce: _trackingNonce, idempotency_key: _idempotencyKey, ...safe } = commission;
      void _trackingHash; void _checkoutHash; void _trackingNonce; void _idempotencyKey;
      return { ...safe, unread_count: unreadById.get(commission.id) || 0 };
    });
    return NextResponse.json({ success: true, count: visible.length, data: visible },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[ADMIN_COMMISSIONS_GET_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
