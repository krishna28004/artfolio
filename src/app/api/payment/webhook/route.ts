import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { computeHmacSha256, timingSafeEqualStr } from "@/shared/utils/crypto";

export async function POST(req: Request) {
  try {
    // 1. Raw body required for cryptographic HMAC verification
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const eventIdHeader = req.headers.get("x-razorpay-event-id");

    if (!signature) {
      console.error("[WEBHOOK_AUTH_FATAL] Received inbound webhook missing x-razorpay-signature header.");
      return NextResponse.json({ success: false, message: "Missing webhook signature header." }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[WEBHOOK_CONFIG_FATAL] RAZORPAY_WEBHOOK_SECRET is not configured on the server.");
      return NextResponse.json({ success: false, message: "Server webhook misconfiguration." }, { status: 500 });
    }

    // 2. Constant-Time Cryptographic Signature Authentication
    const expectedSignature = computeHmacSha256(body, secret);

    if (!timingSafeEqualStr(expectedSignature, signature)) {
      console.warn("[WEBHOOK_SECURITY_WARN] Invalid cryptographic webhook signature intercepted.");
      return NextResponse.json({ success: false, message: "Signature verification failed." }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventId = eventIdHeader || event.id || null;
    const supabaseAdmin = getSupabaseAdmin();

    // 3. Webhook Event Idempotency Check
    if (eventId) {
      const { data: existingEvent } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("event_id", eventId)
        .limit(1)
        .maybeSingle();

      if (existingEvent) {
        return NextResponse.json({ success: true, message: "Event already processed idempotently." });
      }
    }

    // 4. Financial Event: payment.captured
    if (event.event === "payment.captured") {
      const paymentEntity = event.payload?.payment?.entity;
      if (!paymentEntity) {
        console.error("[WEBHOOK_PAYLOAD_ERROR] Missing payment entity in payment.captured payload.");
        return NextResponse.json({ success: false, message: "Malformed payment payload." }, { status: 400 });
      }

      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const capturedAmount = paymentEntity.amount; // In paise
      const currency = paymentEntity.currency;
      const method = paymentEntity.method || null;

      if (!orderId) {
        console.warn("[WEBHOOK_WARN] payment.captured event without order_id. Skipping.");
        return NextResponse.json({ success: true, message: "Unlinked payment skipped." });
      }

      // 5. Authoritative DB Commission Lookup
      const { data: commission, error: dbError } = await supabaseAdmin
        .from("commissions")
        .select("id, status, price, email, name")
        .eq("razorpay_order_id", orderId)
        .single();

      if (dbError || !commission) {
        console.error(`[WEBHOOK_LOOKUP_FAIL] No commission matching Razorpay order ${orderId}:`, dbError);
        return NextResponse.json({ success: true, message: "Commission record not found for order." });
      }

      // 6. Idempotency Check
      if (commission.status === "paid" || commission.status === "fulfilled") {
        return NextResponse.json({ success: true, message: "Payment already processed and recorded." });
      }

      // 7. Strict Currency & Amount Verification (Exact Paise Match)
      if (currency !== "INR") {
        console.error(
          `[WEBHOOK_CURRENCY_FRAUD] Currency mismatch for commission ${commission.id}. Expected INR, got ${currency}`
        );
        return NextResponse.json({ success: false, message: "Invalid payment currency." }, { status: 400 });
      }

      if (capturedAmount !== commission.price) {
        console.error(
          `[WEBHOOK_AMOUNT_FRAUD] Captured amount mismatch for commission ${commission.id}. Expected ${commission.price} paise, got ${capturedAmount} paise`
        );
        return NextResponse.json(
          { success: false, message: "Payment amount does not match approved quote." },
          { status: 400 }
        );
      }

      // 8. Atomic State Transition to 'paid'
      const nowIso = new Date().toISOString();
      const { error: updateError } = await supabaseAdmin
        .from("commissions")
        .update({
          status: "paid",
          razorpay_payment_id: paymentId,
          paid_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", commission.id)
        .in("status", ["approved", "payment_pending"]);

      if (updateError) {
        console.error("[WEBHOOK_UPDATE_FATAL] Failed to update commission status to paid:", updateError);
        return NextResponse.json({ success: false, message: "Database update failure." }, { status: 500 });
      }

      // 9. Record in payments table
      try {
        await supabaseAdmin.from("payments").insert({
          commission_id: commission.id,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          amount: capturedAmount,
          currency: "INR",
          status: "captured",
          method,
          event_id: eventId,
        });
      } catch (payErr) {
        console.warn("[WEBHOOK_PAYMENT_INSERT_WARN]", payErr);
      }

      // 10. Audit Log
      try {
        await supabaseAdmin.from("audit_logs").insert({
          actor: "razorpay_webhook",
          action: "payment_captured",
          target_type: "commission",
          target_id: commission.id,
          metadata: { orderId, paymentId, amount: capturedAmount, eventId },
        });
      } catch (auditErr) {
        console.warn("[AUDIT_LOG_ERROR] Could not log webhook payment capture:", auditErr);
      }

      console.log(`[WEBHOOK_PAYMENT_SECURED] Commission ${commission.id} marked as PAID. Payment: ${paymentId}`);
      return NextResponse.json({ success: true, message: "Payment recorded successfully." });
    }

    // 11. Payment Failed Event Stream
    if (event.event === "payment.failed") {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      const errReason = paymentEntity?.error_description || "Transaction declined";
      const errCode = paymentEntity?.error_code || null;

      if (orderId) {
        const { data: commission } = await supabaseAdmin
          .from("commissions")
          .select("id")
          .eq("razorpay_order_id", orderId)
          .maybeSingle();

        if (commission) {
          try {
            await supabaseAdmin.from("payments").insert({
              commission_id: commission.id,
              razorpay_order_id: orderId,
              razorpay_payment_id: paymentEntity?.id || "unknown",
              amount: paymentEntity?.amount || 0,
              currency: paymentEntity?.currency || "INR",
              status: "failed",
              error_code: errCode,
              error_description: errReason,
              event_id: eventId,
            });
          } catch (insertErr) {
            console.warn("[PAYMENT_FAIL_LOG_WARN]", insertErr);
          }
        }
      }

      return NextResponse.json({ success: true, message: "Failure event received and logged." });
    }

    // 12. Refund Event Stream
    if (event.event === "refund.created" || event.event === "payment.refunded") {
      const refundEntity = event.payload?.refund?.entity || event.payload?.payment?.entity;
      const paymentId = refundEntity?.payment_id || refundEntity?.id;
      const refundAmount = refundEntity?.amount;

      if (paymentId) {
        try {
          const { data: existingPay } = await supabaseAdmin
            .from("payments")
            .select("commission_id, razorpay_order_id")
            .eq("razorpay_payment_id", paymentId)
            .limit(1)
            .maybeSingle();

          if (existingPay) {
            await supabaseAdmin.from("payments").insert({
              commission_id: existingPay.commission_id,
              razorpay_order_id: existingPay.razorpay_order_id,
              razorpay_payment_id: paymentId,
              amount: refundAmount || 0,
              currency: "INR",
              status: "refunded",
              event_id: eventId,
            });

            await supabaseAdmin.from("audit_logs").insert({
              actor: "razorpay_webhook",
              action: "refund_recorded",
              target_type: "commission",
              target_id: existingPay.commission_id,
              metadata: { paymentId, refundAmount, eventId },
            });
          }
        } catch (refundErr) {
          console.warn("[REFUND_LOG_WARN]", refundErr);
        }
      }

      return NextResponse.json({ success: true, message: "Refund event processed." });
    }

    return NextResponse.json({ success: true, message: "Event ignored." });
  } catch (err) {
    console.error("[WEBHOOK_CRITICAL_FAIL]", err);
    return NextResponse.json({ success: false, message: "Webhook server error." }, { status: 500 });
  }
}
