import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { getRazorpayClient } from "@/shared/services/razorpay";
import { computeHmacSha256, timingSafeEqualStr } from "@/shared/utils/crypto";
import { queueCommissionNotice } from "@/features/commission/server/notifications";

type GatewayEvent = {
  id?: string; event?: string;
  payload?: { payment?: { entity?: { id?: string; order_id?: string; amount?: number; currency?: string; status?: string; method?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number; status?: string } } };
};

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ success: false, message: "Webhook unavailable." }, { status: 503 });
    if (!signature || !timingSafeEqualStr(computeHmacSha256(body, secret), signature)) {
      return NextResponse.json({ success: false, message: "Invalid webhook signature." }, { status: 403 });
    }
    const event = JSON.parse(body) as GatewayEvent;
    const eventType = event.event || "unknown";
    const eventId = req.headers.get("x-razorpay-event-id") || event.id ||
      `body_${crypto.createHash("sha256").update(body).digest("hex")}`;
    const admin = getSupabaseAdmin();
    const { error: receiptError } = await admin.from("payment_events").insert({
      event_id: eventId, event_type: eventType, state: "received",
      payment_id: event.payload?.payment?.entity?.id || event.payload?.refund?.entity?.payment_id || null,
      amount: event.payload?.payment?.entity?.amount || event.payload?.refund?.entity?.amount || null,
      currency: event.payload?.payment?.entity?.currency || null,
    });
    if (receiptError && receiptError.code !== "23505") {
      console.error("[WEBHOOK_RECEIPT_ERROR]", receiptError);
      return NextResponse.json({ success: false, message: "Webhook receipt unavailable." }, { status: 503 });
    }
    if (receiptError?.code === "23505") {
      const { data: existing } = await admin.from("payment_events").select("state")
        .eq("event_id", eventId).maybeSingle();
      if (existing?.state === "processed" || existing?.state === "ignored") {
        return NextResponse.json({ success: true, message: "Event already processed." });
      }
    }

    if (eventType === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (!payment?.id || !payment.order_id || !Number.isInteger(payment.amount) || payment.amount! <= 0 || payment.currency !== "INR") {
        return NextResponse.json({ success: false, message: "Invalid capture payload." }, { status: 400 });
      }
      const { data: commission, error } = await admin.from("commissions")
        .select("id, price, currency, email, quote_version, accepted_quote_version")
        .eq("razorpay_order_id", payment.order_id).maybeSingle();
      if (error || !commission) return NextResponse.json({ success: false, message: "Unknown order; retry later." }, { status: 503 });
      if (commission.price !== payment.amount || commission.currency !== payment.currency ||
          (commission.quote_version > 0 && commission.accepted_quote_version !== commission.quote_version)) {
        return NextResponse.json({ success: false, message: "Capture does not match quote." }, { status: 409 });
      }
      const gateway = getRazorpayClient();
      const [gatewayOrder, gatewayPayment] = await Promise.all([
        gateway.orders.fetch(payment.order_id), gateway.payments.fetch(payment.id),
      ]);
      if (gatewayOrder.amount !== commission.price || gatewayOrder.currency !== commission.currency ||
          gatewayPayment.order_id !== payment.order_id || gatewayPayment.status !== "captured" ||
          gatewayPayment.amount !== commission.price || gatewayPayment.currency !== commission.currency) {
        return NextResponse.json({ success: false, message: "Gateway capture mismatch." }, { status: 409 });
      }
      const { data: captured, error: captureError } = await admin.rpc("record_commission_capture", {
        p_commission_id: commission.id, p_order_id: payment.order_id, p_payment_id: payment.id,
        p_amount: commission.price, p_currency: commission.currency,
        p_method: gatewayPayment.method || null, p_event_id: eventId,
      });
      if (captureError || captured !== "captured") {
        console.error("[WEBHOOK_CAPTURE_ERROR]", captureError);
        return NextResponse.json({ success: false, message: "Capture persistence failed." }, { status: 503 });
      }
      const { data: timeline } = await admin.from("commission_events").select("id")
        .eq("commission_id", commission.id).eq("event_type", "payment_captured")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (timeline && commission.email) await queueCommissionNotice(commission.id, timeline.id, commission.email, "customer");
      return NextResponse.json({ success: true, message: "Capture recorded." });
    }

    if (eventType === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      const { data: commission } = payment?.order_id ? await admin.from("commissions")
        .select("id").eq("razorpay_order_id", payment.order_id).maybeSingle() : { data: null };
      const { error } = await admin.from("payment_events").update({
        commission_id: commission?.id || null, state: "processed", processed_at: new Date().toISOString(),
      }).eq("event_id", eventId);
      if (error) return NextResponse.json({ success: false, message: "Failure event persistence failed." }, { status: 503 });
      return NextResponse.json({ success: true, message: "Failed attempt recorded; checkout remains open." });
    }

    if (eventType === "refund.created" || eventType === "refund.processed") {
      const refund = event.payload?.refund?.entity;
      if (!refund?.id || !refund.payment_id || !Number.isInteger(refund.amount) || refund.amount! <= 0) {
        return NextResponse.json({ success: false, message: "Invalid refund payload." }, { status: 400 });
      }
      const { data: payment } = await admin.from("payments").select("id, commission_id, amount, status")
        .eq("razorpay_payment_id", refund.payment_id).maybeSingle();
      if (!payment) return NextResponse.json({ success: false, message: "Refund payment unavailable; retry later." }, { status: 503 });
      if (refund.amount! > payment.amount) return NextResponse.json({ success: false, message: "Refund exceeds payment." }, { status: 409 });
      const processed = eventType === "refund.processed" && refund.status === "processed";
      const { error: refundError } = await admin.rpc("record_commission_refund", {
        p_event_id: eventId, p_refund_id: refund.id, p_payment_id: refund.payment_id,
        p_amount: refund.amount!, p_processed: processed,
      });
      if (refundError) {
        console.error("[REFUND_RECORD_ERROR]", refundError);
        return NextResponse.json({ success: false, message: "Refund persistence failed; retry later." }, { status: 503 });
      }
      return NextResponse.json({ success: true, message: "Refund event recorded." });
    }

    const { error: ignoredError } = await admin.from("payment_events")
      .update({ state: "ignored", processed_at: new Date().toISOString() }).eq("event_id", eventId);
    if (ignoredError) return NextResponse.json({ success: false, message: "Webhook event persistence failed." }, { status: 503 });
    return NextResponse.json({ success: true, message: "Event ignored." });
  } catch (error) {
    console.error("[WEBHOOK_FATAL]", error);
    return NextResponse.json({ success: false, message: "Webhook temporarily unavailable." }, { status: 503 });
  }
}
