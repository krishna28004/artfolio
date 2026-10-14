import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";
import { authorizeCustomer } from "@/features/commission/server/customer-access";
import { acceptedQuoteCheckoutToken } from "@/features/commission/server/checkout-token";
import { hashAccessToken } from "@/features/commission/server/customer-access";

export async function GET(req: NextRequest) {
  const limit = await checkDistributedRateLimit(`tracking_read_${getClientIp(req)}`, 60, 15 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ success: false, message: "Too many requests." }, { status: 429 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const commission = await authorizeCustomer(req, id);
  if (!commission) return NextResponse.json({ success: false, message: "Private request unavailable." }, { status: 403 });
  const admin = getSupabaseAdmin();
  const [{ data: events, error: eventsError }, { data: files, error: filesError }] = await Promise.all([
    admin.from("commission_events").select("id, actor_type, event_type, body, metadata, created_at")
      .eq("commission_id", id).order("created_at", { ascending: true }).limit(200),
    admin.from("commission_files").select("id, kind, file_name, size_bytes, delivered_at")
      .eq("commission_id", id).order("created_at", { ascending: true }),
  ]);
  if (eventsError || filesError) return NextResponse.json({ success: false, message: "Tracking is temporarily unavailable." }, { status: 503 });
  const checkoutToken = commission.accepted_quote_version && commission.checkout_token_hash &&
    ["approved", "payment_pending"].includes(commission.status) ?
      acceptedQuoteCheckoutToken(id, commission.accepted_quote_version) : null;
  const checkoutUrl = checkoutToken && commission.checkout_token_hash === hashAccessToken(checkoutToken) &&
    commission.expires_at && new Date(commission.expires_at).getTime() > Date.now() ?
      `/checkout/${id}?token=${encodeURIComponent(checkoutToken)}` : null;
  const { tracking_token_hash: _trackingHash, checkout_token_hash: _checkoutHash, ...visibleCommission } = commission;
  void _trackingHash; void _checkoutHash;
  return NextResponse.json({ success: true, commission: visibleCommission, events, files: (files || []).filter((file) => file.kind !== "deliverable" || !!file.delivered_at), checkoutUrl }, {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
