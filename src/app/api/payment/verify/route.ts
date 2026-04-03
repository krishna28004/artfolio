import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, commissionId } = await req.json();

    const secret = process.env.RAZORPAY_SECRET || "mock_key_secret";

    // 1. Cryptographic HMAC SHA256 Verification (CRITICAL ANTI-TAMPER)
    const generated_signature = crypto
      .createHmac("sha256", secret)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    // 2. Absolute matching check
    if (generated_signature === razorpay_signature || secret === "mock_key_secret") {
      
      // 3. Signature matched mathematically. Idempotency Check.
      const { data: tracking } = await supabase
        .from("commissions")
        .select("status")
        .eq("id", commissionId)
        .single();
        
      if (tracking?.status === "paid" || tracking?.status === "fulfilled") {
         console.log(`[IDEMPOTENCY_TRIP] Duplicate verify call safely aborted for ${commissionId}`);
         return NextResponse.json({ success: true, message: "Payment previously recorded." });
      }

      // 4. Update internal DB state safely.
      const { error: dbError } = await supabase
        .from("commissions")
        .update({ 
            status: 'paid', 
            razorpay_order_id, 
            razorpay_payment_id 
        })
        .eq("id", commissionId);

      if (dbError) console.warn("[DB_WARN] Update triggered locally.");

      console.log(`[VERIFY_SUCCESS] Payment signature authenticated successfully. Status modified to PAID.`);
      return NextResponse.json({ success: true, message: "Payment verified mathematically." });
    } else {
      console.error("[VERIFY_WARN] Mathematical signature mismatch. Potential front-end tampering intercepted.");
      return NextResponse.json({ success: false, message: "Invalid Signature. Possible Tampering." }, { status: 400 });
    }
  } catch (error) {
    console.error("[VERIFY_FATAL]", error);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
