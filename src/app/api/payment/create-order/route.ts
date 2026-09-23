import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { razorpay } from "@/shared/services/razorpay";
import { supabaseAdmin } from "@/shared/services/supabase-admin";
import { isPositivePaise } from "@/shared/utils/money";
import { timingSafeEqualStr } from "@/shared/utils/crypto";

const createOrderSchema = z.object({
  commissionId: z.string().uuid("Invalid commission ID format."),
  token: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parseResult = createOrderSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: "Invalid payload.", errors: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { commissionId, token } = parseResult.data;

    // 1. Authoritative Lookup from DB via Service Role Client
    const { data: commission, error: dbError } = await supabaseAdmin
      .from("commissions")
      .select("id, price, status, expires_at, razorpay_order_id, checkout_token_hash")
      .eq("id", commissionId)
      .single();

    if (dbError || !commission) {
      console.error("[ORDER_LOOKUP_FATAL] Commission lookup failed:", dbError);
      return NextResponse.json(
        { success: false, message: "Commission record not found." },
        { status: 404 }
      );
    }

    // 2. Token-Gated Clearance Check (Bearer credential)
    if (commission.checkout_token_hash) {
      if (!token) {
        return NextResponse.json(
          { success: false, message: "Private security clearance token required." },
          { status: 403 }
        );
      }

      const inputHash = crypto.createHash("sha256").update(token).digest("hex");
      if (!timingSafeEqualStr(inputHash, commission.checkout_token_hash)) {
        return NextResponse.json(
          { success: false, message: "Invalid acquisition access token." },
          { status: 403 }
        );
      }
    }

    // 3. State Machine Checks
    if (commission.status === "paid" || commission.status === "fulfilled") {
      return NextResponse.json(
        { success: false, message: "This commission has already been paid and secured." },
        { status: 400 }
      );
    }

    if (commission.status === "pending") {
      return NextResponse.json(
        { success: false, message: "Commission has not been approved yet." },
        { status: 400 }
      );
    }

    if (commission.status === "cancelled" || commission.status === "rejected") {
      return NextResponse.json(
        { success: false, message: `This commission has been ${commission.status}.` },
        { status: 400 }
      );
    }

    // 4. Expiration Check
    if (commission.expires_at) {
      const isExpired = new Date() > new Date(commission.expires_at);
      if (isExpired || commission.status === "expired") {
        if (commission.status !== "expired") {
          await supabaseAdmin
            .from("commissions")
            .update({ status: "expired" })
            .eq("id", commissionId);
        }
        return NextResponse.json(
          { success: false, message: "This acquisition window has permanently expired (24-hour limit)." },
          { status: 410 }
        );
      }
    }

    // 5. Financial Integrity Check (Strict positive integer paise)
    const pricePaise = commission.price;
    if (!isPositivePaise(pricePaise)) {
      console.error(`[ORDER_PRICE_FATAL] Invalid price in database for commission ${commissionId}:`, pricePaise);
      return NextResponse.json(
        { success: false, message: "Commission pricing is uninitialized or invalid." },
        { status: 400 }
      );
    }

    // 6. Generate Authenticated Razorpay Order
    // Note: Razorpay amount expects the exact integer paise value.
    const receiptId = `c_${commissionId.replace(/-/g, "").slice(0, 36)}`;
    const order = await razorpay.orders.create({
      amount: pricePaise, // Exact paise integer
      currency: "INR",
      receipt: receiptId,
      notes: {
        commissionId,
      },
    });

    // 7. Insert Audit/Payment record in 'payments' table
    try {
      await supabaseAdmin.from("payments").insert({
        commission_id: commissionId,
        razorpay_order_id: order.id,
        amount: pricePaise,
        currency: "INR",
        status: "created",
      });
    } catch (payErr) {
      console.warn("[PAYMENT_AUDIT_INSERT_WARN] Failed to insert initial payment record:", payErr);
    }

    // 8. Record Razorpay Order ID & transition to payment_pending
    await supabaseAdmin
      .from("commissions")
      .update({
        razorpay_order_id: order.id,
        status: "payment_pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", commissionId)
      .in("status", ["approved", "payment_pending"]);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: pricePaise, // In paise
      currency: "INR",
    });
  } catch (error) {
    console.error("[CREATE_ORDER_FATAL]", error);
    return NextResponse.json(
      { success: false, message: "Secure transaction could not be initialized." },
      { status: 500 }
    );
  }
}
