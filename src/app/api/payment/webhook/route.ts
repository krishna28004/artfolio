import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    // Webhook bodies must be processed as raw text to compute accurate signatures
    const body = await req.text(); 
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      console.error("[WEBHOOK_FATAL] Received inbound webhook missing signature header.");
      return NextResponse.json({ success: false }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "mock_webhook_secret";

    // 1. Cryptographic Authentication
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature && secret !== "mock_webhook_secret") {
       console.error(`[WEBHOOK_FATAL] Invalid Cryptographic Signature intercepted from Razorpay origin.`);
       return NextResponse.json({ success: false }, { status: 400 });
    }

    const event = JSON.parse(body);

    // 2. Financial Event Router
    if (event.event === "payment.captured") {
      const paymentEntity = event.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amount = paymentEntity.amount;

      console.log(`[TX_CAPTURED] Webhook Authorized - Order: ${orderId} | Payment: ${paymentId} | Amount: ${amount}`);

      // 3. Idempotent DB Write (Race Safe)
      const { data: commission } = await supabase
        .from("commissions")
        .select("status")
        .eq("razorpay_order_id", orderId)
        .single();
        
      if (commission?.status === "paid") {
         console.log(`[IDEMPOTENCY_TRIP] Duplicate webhook skip for Order: ${orderId}`);
         return NextResponse.json({ success: true, message: "Already processed" });
      }

      await supabase
        .from("commissions")
        .update({ status: 'paid', razorpay_payment_id: paymentId })
        .eq("razorpay_order_id", orderId)
        // Ensure we only update if it's explicitly approved (never overwrite fulfilled or expired states)
        .eq("status", "approved");

      return NextResponse.json({ success: true });
    } 
    
    // Unsuccessful Payment Event Stream
    if (event.event === "payment.failed") {
      const errReason = event.payload.payment.entity.error_description;
      console.warn(`[TX_FAILED] Webhook Notified - Reason: ${errReason}`);
      
      // We do NOT mutate DB status to 'rejected'. We allow the user to immediately retry before the 24h deadline expires.
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });

  } catch (err) {
    console.error("[WEBHOOK_CRITICAL_FAIL]", err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
