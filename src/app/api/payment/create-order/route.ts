import { NextResponse } from "next/server";
import { razorpay } from "@/shared/services/razorpay";
import { supabase } from "@/shared/services/supabase";

export async function POST(req: Request) {
  try {
    const { commissionId } = await req.json();

    // 1. Retrieve the statically locked price and expiry constraint from the database
    const { data: commission, error: dbError } = await supabase
      .from("commissions")
      .select("price, status, expires_at")
      .eq("id", commissionId)
      .single();

    if (dbError || !commission || typeof commission.price !== 'number' || commission.price <= 0) {
      console.error("[ORDER_FATAL] Invalid or missing commission lookup:", dbError);
      return NextResponse.json({ success: false, message: "Invalid commission request." }, { status: 400 });
    }

    if (commission.status === "paid" || commission.status === "fulfilled") {
      console.warn(`[ORDER_FATAL] Attempt to recreate order for terminal commission: ${commissionId}`);
      return NextResponse.json({ success: false, message: "This commission has already been paid or fulfilled." }, { status: 400 });
    }

    // 1B. Expiration Deadline Enforcement Algorithm
    if (commission.expires_at) {
      if (new Date() > new Date(commission.expires_at)) {
        console.warn(`[ORDER_EXPIRED] Order generation blocked for dead commission allocation: ${commissionId}`);

        // Auto-mutate DB to expired state actively closing window
        await supabase.from("commissions").update({ status: "expired" }).eq("id", commissionId);

        return NextResponse.json({ success: false, message: "Acquisition window permanently expired." }, { status: 410 });
      }
    }

    const price = commission.price;

    // 2. Generate secure authenticated order via Razorpay Server
    const order = await razorpay.orders.create({
      amount: price,
      currency: "INR",
      receipt: `cart_${commissionId}`,
    });

    return NextResponse.json({ success: true, orderId: order.id, amount: price });
  } catch (error) {
    console.error("[RAZORPAY_FATAL]", error);

    return NextResponse.json({ success: false, message: "Secure transaction link could not be generated.", error: String(error) }, { status: 500 });
  }
}
