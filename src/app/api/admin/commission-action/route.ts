import { logSecurityFailure } from "@/shared/utils/security-log";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { makeTrackingToken } from "@/features/commission/server/tracking-token";
import { deliverPendingNotifications } from "@/features/commission/server/notifications";
import type { Database } from "@/types/supabase";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["send_quote", "reply", "start", "progress", "resolve_revision", "ready", "deliver", "cancel", "reject", "rotate_token"]),
  body: z.string().trim().max(2000).optional(),
  priceRupees: z.number().int().min(1).max(10_000_000).optional(),
  scope: z.string().trim().min(10).max(2000).optional(),
  terms: z.string().trim().min(10).max(2000).optional(),
  estimatedDeliveryAt: z.string().datetime().optional(),
  revisionAllowance: z.number().int().min(0).max(20).optional(),
  adminNotes: z.string().trim().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ success: false, message: "Owner access required." }, { status: 401 });
  const origin = req.headers.get("origin");
  if (auth.source === "session" && origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid action details." }, { status: 400 });
  const { id, action, body } = parsed.data;
  const admin = getSupabaseAdmin();
  const { data: commission, error } = await admin.from("commissions")
    .select("id, status, email, price, quote_version, request_reference, tracking_nonce")
    .eq("id", id).maybeSingle();
  if (error || !commission) return NextResponse.json({ success: false, message: "Commission unavailable." }, { status: 404 });
  const update: Database["public"]["Tables"]["commissions"]["Update"] = { updated_at: new Date().toISOString() };
  let nextStatus: Database["public"]["Tables"]["commissions"]["Row"]["status"] | null = null;
  let rawToken: string | undefined;
  if (action === "send_quote") {
    if (!["pending", "under_review", "clarification_requested", "quote_sent"].includes(commission.status)) {
      return NextResponse.json({ success: false, message: "A paid or closed quote cannot be changed." }, { status: 409 });
    }
    if (!parsed.data.priceRupees || !parsed.data.scope || !parsed.data.terms ||
        parsed.data.revisionAllowance === undefined || !parsed.data.estimatedDeliveryAt) {
      return NextResponse.json({ success: false, message: "Price, scope, terms, date, and revision policy are required." }, { status: 400 });
    }
    update.price = parsed.data.priceRupees * 100;
    update.quote_scope = parsed.data.scope;
    update.quote_terms = parsed.data.terms;
    update.estimated_delivery_at = parsed.data.estimatedDeliveryAt;
    update.revision_allowance = parsed.data.revisionAllowance;
    update.admin_notes = parsed.data.adminNotes || null;
    update.quote_version = commission.quote_version + 1;
    update.accepted_quote_version = null;
    update.checkout_token_hash = null;
    update.razorpay_order_id = null;
    update.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    nextStatus = "quote_sent";
  } else if (action === "start") {
    if (commission.status !== "paid") return NextResponse.json({ success: false, message: "Payment is required before work starts." }, { status: 409 });
    nextStatus = "in_progress";
  } else if (action === "resolve_revision") {
    if (commission.status !== "revision_requested") return NextResponse.json({ success: false, message: "No revision is open." }, { status: 409 });
    nextStatus = "in_progress";
  } else if (action === "ready") {
    if (commission.status !== "in_progress") return NextResponse.json({ success: false, message: "Work must be in progress." }, { status: 409 });
    nextStatus = "ready_for_delivery";
  } else if (action === "deliver") {
    if (commission.status !== "ready_for_delivery") return NextResponse.json({ success: false, message: "Work is not ready for delivery." }, { status: 409 });
    const { count, error: filesError } = await admin.from("commission_files").select("id", { count: "exact", head: true })
      .eq("commission_id", id).eq("kind", "deliverable");
    if (filesError || !count) return NextResponse.json({ success: false, message: "Upload a private deliverable first." }, { status: 409 });
    nextStatus = "delivered";
  } else if (action === "cancel") {
    if (!["pending", "under_review", "clarification_requested", "quote_sent", "approved", "expired"].includes(commission.status)) {
      return NextResponse.json({ success: false, message: "Paid work needs refund review before cancellation." }, { status: 409 });
    }
    if (!body || body.length < 3) return NextResponse.json({ success: false, message: "Cancellation reason required." }, { status: 400 });
    nextStatus = "cancelled";
    update.checkout_token_hash = null;
  } else if (action === "reject") {
    if (!["pending", "under_review", "clarification_requested", "quote_sent"].includes(commission.status)) {
      return NextResponse.json({ success: false, message: "Only unpaid inquiries can be declined." }, { status: 409 });
    }
    if (!body || body.length < 3) return NextResponse.json({ success: false, message: "A decline reason is required." }, { status: 400 });
    nextStatus = "rejected";
    update.checkout_token_hash = null;
  } else if (action === "reply" || action === "progress") {
    if (!body || body.length < 3) return NextResponse.json({ success: false, message: "Write a message first." }, { status: 400 });
    if (action === "progress" && commission.status !== "in_progress") {
      return NextResponse.json({ success: false, message: "Progress updates require work in progress." }, { status: 409 });
    }
  } else if (action === "rotate_token") {
    const nonce = crypto.randomBytes(32).toString("base64url");
    rawToken = makeTrackingToken(nonce);
    update.tracking_nonce = nonce;
    update.tracking_token_hash = crypto.createHash("sha256").update(rawToken).digest("hex");
    update.tracking_token_rotated_at = new Date().toISOString();
  }
  delete update.updated_at;
  const eventType = action === "send_quote" ? "quote_sent" : action;
  const metadata = action === "send_quote" ? {
    quote_version: commission.quote_version + 1, price: update.price!,
    scope: parsed.data.scope!, terms: parsed.data.terms!,
    estimated_delivery_at: parsed.data.estimatedDeliveryAt!,
    revision_allowance: parsed.data.revisionAllowance!,
  } : {};
  const result = action === "deliver"
    ? await admin.rpc("release_commission_deliverables", { p_commission_id: id, p_actor: auth.userEmail || "owner", p_body: body || null })
    : await admin.rpc("apply_commission_transition", {
      p_commission_id: id, p_expected_status: commission.status, p_quote_version: commission.quote_version,
      p_next_status: nextStatus, p_action: eventType, p_actor_type: "owner", p_actor: auth.userEmail || "owner",
      p_body: body || null, p_metadata: metadata, p_changes: update,
      p_notify_recipient: commission.email, p_notify_audience: "customer",
    });
  if (result.error || !result.data) return NextResponse.json({ success: false, message: "The request changed or could not be saved. Refresh and retry." }, { status: 409 });
  if (process.env.RESEND_API_KEY) await deliverPendingNotifications(1).catch(() => logSecurityFailure("[OWNER_NOTICE_ERROR]"));
  return NextResponse.json({ success: true, trackingToken: rawToken }, { headers: { "Cache-Control": "no-store" } });
}