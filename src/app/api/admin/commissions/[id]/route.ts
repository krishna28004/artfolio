import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { z } from "zod";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
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
        .eq("commission_id", commissionId).order("created_at", { ascending: false }).limit(200),
      supabaseAdmin.from("commission_refunds").select("id, amount, status, reason, razorpay_refund_id, created_at")
        .eq("commission_id", commissionId).order("created_at", { ascending: false }),
    ]);
    const { tracking_token_hash: _trackingHash, checkout_token_hash: _checkoutHash,
      tracking_nonce: _trackingNonce, idempotency_key: _idempotencyKey, ...visible } = commission;
    void _trackingHash; void _checkoutHash; void _trackingNonce; void _idempotencyKey;
    const readThrough = (events || []).filter((event) => event.actor_type === "customer")
      .map((event) => event.created_at).sort().at(-1) || null;
    return NextResponse.json({ success: true, readThrough, data: { ...visible, files: files || [], events: (events || []).reverse(), refunds: refunds || [] } },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[ADMIN_COMMISSION_DETAIL_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> | { id: string } }) {
  if (!(await verifyAdminAuth(req, { requireMfa: true })).authorized) {
    return NextResponse.json({ success: false, message: "Verified owner access required." }, { status: 401 });
  }
  const { id } = await Promise.resolve(context.params);
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ success: false, message: "Invalid commission ID." }, { status: 400 });
  }
  const input = z.object({ seenThrough: z.string().datetime({ offset: true }) }).safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ success: false, message: "A displayed message boundary is required." }, { status: 400 });
  const { error } = await getSupabaseAdmin().rpc("mark_commission_owner_read", {
    p_commission_id: id, p_seen_through: input.data.seenThrough,
  });
  if (error) return NextResponse.json({ success: false, message: "Could not mark messages as read." }, { status: 503 });
  return NextResponse.json({ success: true });
}
