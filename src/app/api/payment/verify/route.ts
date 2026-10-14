import { logSecurityFailure } from "@/shared/utils/security-log";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getRazorpayClient } from "@/shared/services/razorpay";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { computeHmacSha256, timingSafeEqualStr } from "@/shared/utils/crypto";
import { queueCommissionNotice, deliverPendingNotifications } from "@/features/commission/server/notifications";

const schema = z.object({
  commissionId: z.string().uuid(),
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid payment response." }, { status: 400 });
    const { commissionId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;
    const secret = process.env.RAZORPAY_SECRET;
    if (!secret) return NextResponse.json({ success: false, message: "Payment verification unavailable." }, { status: 503 });
    if (!timingSafeEqualStr(computeHmacSha256(`${orderId}|${paymentId}`, secret), signature)) {
      return NextResponse.json({ success: false, message: "Invalid payment signature." }, { status: 403 });
    }
    const admin = getSupabaseAdmin();
    const { data: commission, error } = await admin.from("commissions")
      .select("id, status, price, currency, razorpay_order_id, razorpay_payment_id, quote_version, accepted_quote_version, email")
      .eq("id", commissionId).maybeSingle();
    if (error || !commission) return NextResponse.json({ success: false, message: "Commission unavailable." }, { status: 404 });
    if (commission.razorpay_order_id !== orderId || !commission.price ||
        (commission.quote_version > 0 && commission.accepted_quote_version !== commission.quote_version)) {
      return NextResponse.json({ success: false, message: "Order is not associated with the accepted quote." }, { status: 409 });
    }
    if (["paid", "in_progress", "revision_requested", "ready_for_delivery", "delivered", "completed", "fulfilled"].includes(commission.status)) {
      return commission.razorpay_payment_id === paymentId ?
        NextResponse.json({ success: true, message: "Payment already recorded." }) :
        NextResponse.json({ success: false, message: "A different payment is already recorded." }, { status: 409 });
    }
    const razorpay = getRazorpayClient();
    const [gatewayOrder, gatewayPayment] = await Promise.all([
      razorpay.orders.fetch(orderId), razorpay.payments.fetch(paymentId),
    ]);
    if (gatewayOrder.amount !== commission.price || gatewayOrder.currency !== commission.currency ||
        gatewayPayment.order_id !== orderId || gatewayPayment.status !== "captured" ||
        gatewayPayment.amount !== commission.price || gatewayPayment.currency !== commission.currency) {
      return NextResponse.json({ success: false, message: "Gateway payment does not match the accepted quote." }, { status: 409 });
    }
    const { data: result, error: captureError } = await admin.rpc("record_commission_capture", {
      p_commission_id: commissionId, p_order_id: orderId, p_payment_id: paymentId,
      p_amount: commission.price, p_currency: commission.currency, p_method: gatewayPayment.method || null,
    });
    if (captureError || result !== "captured") {
      logSecurityFailure("[CAPTURE_RECORD_ERROR]", captureError);
      return NextResponse.json({ success: false, message: "Payment captured but recording is pending. The studio will reconcile it." }, { status: 503 });
    }
    const { data: event } = await admin.from("commission_events").select("id")
      .eq("commission_id", commissionId).eq("event_type", "payment_captured")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (event && commission.email) {
      await queueCommissionNotice(commissionId, event.id, commission.email, "customer");
      if (process.env.RESEND_API_KEY) await deliverPendingNotifications(1).catch((cause) => logSecurityFailure("[PAYMENT_NOTICE_ERROR]", cause));
    }
    return NextResponse.json({ success: true, message: "Payment captured and recorded." });
  } catch (error) {
    logSecurityFailure("[VERIFY_FATAL]", error);
    return NextResponse.json({ success: false, message: "Payment verification temporarily unavailable." }, { status: 503 });
  }
}
