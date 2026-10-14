import { logSecurityFailure } from "@/shared/utils/security-log";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json(
        { success: false, message: authResult.error || "Unauthorized administrative clearance." },
        { status: 401 }
      );
    }

    const params = await Promise.resolve(context.params);
    const commissionId = params.id;

    const supabaseAdmin = getSupabaseAdmin();
    const { data: commission, error } = await supabaseAdmin
      .from("commissions")
      .select("*, payments(*)")
      .eq("id", commissionId)
      .single();

    if (error || !commission) {
      return NextResponse.json({ success: false, message: "Commission not found." }, { status: 404 });
    }

    const [{ data: files }, { data: events }, { data: refunds }] = await Promise.all([
      supabaseAdmin.from("commission_files").select("id, kind, file_name, size_bytes, created_at, delivered_at, accessed_at")
        .eq("commission_id", commissionId).order("created_at", { ascending: true }),
      supabaseAdmin.from("commission_events").select("id, actor_type, event_type, body, metadata, created_at")
        .eq("commission_id", commissionId).order("created_at", { ascending: true }).limit(200),
      supabaseAdmin.from("commission_refunds").select("id, amount, status, reason, razorpay_refund_id, created_at")
        .eq("commission_id", commissionId).order("created_at", { ascending: false }),
    ]);
    const { tracking_token_hash: _trackingHash, checkout_token_hash: _checkoutHash,
      tracking_nonce: _trackingNonce, idempotency_key: _idempotencyKey, ...visible } = commission;
    void _trackingHash; void _checkoutHash; void _trackingNonce; void _idempotencyKey;
    return NextResponse.json({ success: true, data: { ...visible, files: files || [], events: events || [], refunds: refunds || [] } },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logSecurityFailure("[ADMIN_COMMISSION_DETAIL_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
