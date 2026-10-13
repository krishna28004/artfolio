import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { authorizeCustomer } from "@/features/commission/server/customer-access";
import { acceptedQuoteCheckoutToken } from "@/features/commission/server/checkout-token";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";
import type { Database, CommissionStatus } from "@/types/supabase";
import { queueCommissionNotice, deliverPendingNotifications } from "@/features/commission/server/notifications";

const schema = z.object({
  id: z.string().uuid(),
  action: z.enum(["message", "request_clarification", "accept_quote", "decline_quote", "request_revision", "complete", "delivery_issue", "request_refund"]),
  body: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403 });
  }
  const limit = await checkDistributedRateLimit(`tracking_action_${getClientIp(req)}`, 20, 60 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ success: false, message: "Too many updates." }, { status: 429 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid action." }, { status: 400 });
  const { id, action, body } = parsed.data;
  const commission = await authorizeCustomer(req, id);
  if (!commission) return NextResponse.json({ success: false, message: "Private request unavailable." }, { status: 403 });
  const admin = getSupabaseAdmin();
  const now = new Date().toISOString();
  const messageRequired = ["message", "request_clarification", "request_revision", "delivery_issue", "request_refund"].includes(action);
  if (messageRequired && (!body || body.length < 3)) {
    return NextResponse.json({ success: false, message: "Please add a short explanation." }, { status: 400 });
  }
  let nextStatus: CommissionStatus | null = null;
  const update: Database["public"]["Tables"]["commissions"]["Update"] = { updated_at: now };
  if (action === "accept_quote") {
    if (commission.status !== "quote_sent" || !commission.price || !commission.quote_scope || !commission.quote_terms || commission.quote_version < 1) {
      return NextResponse.json({ success: false, message: "No current complete quote is available." }, { status: 409 });
    }
    nextStatus = "approved";
    update.accepted_quote_version = commission.quote_version;
    const token = acceptedQuoteCheckoutToken(id, commission.quote_version);
    update.checkout_token_hash = crypto.createHash("sha256").update(token).digest("hex");
    update.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  } else if (action === "decline_quote") {
    if (commission.status !== "quote_sent") return NextResponse.json({ success: false, message: "Quote is no longer open." }, { status: 409 });
    nextStatus = "cancelled";
  } else if (action === "request_clarification") {
    if (commission.status !== "quote_sent") return NextResponse.json({ success: false, message: "Quote is no longer open." }, { status: 409 });
    nextStatus = "clarification_requested";
  } else if (action === "request_revision") {
    if (commission.status !== "in_progress" && commission.status !== "delivered") {
      return NextResponse.json({ success: false, message: "Revisions are unavailable at this stage." }, { status: 409 });
    }
    const { count, error } = await admin.from("commission_events").select("id", { count: "exact", head: true })
      .eq("commission_id", id).eq("event_type", "revision_requested");
    if (error || (count || 0) >= commission.revision_allowance) {
      return NextResponse.json({ success: false, message: "Included revision allowance has been used." }, { status: 409 });
    }
    nextStatus = "revision_requested";
  } else if (action === "complete") {
    if (commission.status !== "delivered") return NextResponse.json({ success: false, message: "Work is not delivered yet." }, { status: 409 });
    nextStatus = "completed";
  } else if (action === "delivery_issue") {
    if (commission.status !== "delivered") return NextResponse.json({ success: false, message: "No delivery is awaiting review." }, { status: 409 });
    nextStatus = "revision_requested";
  } else if (action === "request_refund") {
    if (!["paid", "in_progress", "revision_requested", "ready_for_delivery", "delivered"].includes(commission.status)) {
      return NextResponse.json({ success: false, message: "Refund review is unavailable at this stage." }, { status: 409 });
    }
  } else if (action === "message" && ["rejected", "cancelled", "completed", "fulfilled"].includes(commission.status)) {
    return NextResponse.json({ success: false, message: "This request is closed." }, { status: 409 });
  }

  let eventId: string;
  if (action === "accept_quote") {
    const { data, error } = await admin.rpc("accept_commission_quote", {
      p_commission_id: id, p_quote_version: commission.quote_version,
      p_checkout_token_hash: update.checkout_token_hash!, p_expires_at: update.expires_at!,
    });
    if (error || !data) return NextResponse.json({ success: false, message: "Quote changed. Refresh and try again." }, { status: 409 });
    eventId = data;
  } else {
    if (nextStatus) {
      update.status = nextStatus;
      const { data, error } = await admin.from("commissions").update(update)
        .eq("id", id).eq("status", commission.status).eq("quote_version", commission.quote_version)
        .select("id").maybeSingle();
      if (error || !data) return NextResponse.json({ success: false, message: "Request changed. Refresh and try again." }, { status: 409 });
    }
    const { data: event, error: eventError } = await admin.from("commission_events").insert({
      commission_id: id, actor_type: "customer", event_type: action === "request_revision" ? "revision_requested" : action,
      body: body || null, metadata: {},
    }).select("id").single();
    if (eventError || !event) {
      console.error("[CUSTOMER_EVENT_ERROR]", eventError);
      return NextResponse.json({ success: false, message: "Update saved, but history recording failed. Contact the studio." }, { status: 503 });
    }
    eventId = event.id;
  }
  const ownerEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (ownerEmail) {
    await queueCommissionNotice(id, eventId, ownerEmail, "owner");
    if (process.env.RESEND_API_KEY) await deliverPendingNotifications(1).catch((cause) => console.error("[CUSTOMER_NOTICE_ERROR]", cause));
  }
  return NextResponse.json({ success: true });
}
