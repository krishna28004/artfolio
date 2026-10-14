import { logSecurityFailure } from "@/shared/utils/security-log";
import { isPaymentCheckoutEnabled } from "@/shared/utils/release-controls";
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
  if (!isPaymentCheckoutEnabled()) return NextResponse.json({ success: false, message: "Checkout is temporarily unavailable. Please try again later." }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3600" },
  });
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
      .select("id, price, currency, status, expires_at, razorpay_order_id, checkout_token_hash, quote_version, accepted_quote_version")
      .eq("id", commissionId)
      .single();

    if (dbError || !commission) {
      logSecurityFailure("[ORDER_LOOKUP_FATAL] Commission lookup failed:", dbError);
      return NextResponse.json(
        { success: false, message: "Commission record not found." },
        { status: 404 }
      );
    }

    // 2. Token-Gated Clearance Check (Bearer credential or HttpOnly Session Cookie)
    if (!commission.checkout_token_hash) {
      return NextResponse.json(
        { success: false, message: "No active checkout authorization found for this commission." },
        { status: 403 }
      );
    }

    const sessionCookieName = `checkout_session_${commissionId}`;
    const cookieHeader = req.headers.get("cookie") || "";
    let sessionCookieVal = "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${sessionCookieName}=([^;]*)`));
    if (match) {
      sessionCookieVal = decodeURIComponent(match[1]);
    }

    let isAuthorized = false;
    if (token) {
      const inputHash = crypto.createHash("sha256").update(token).digest("hex");
      if (timingSafeEqualStr(inputHash, commission.checkout_token_hash)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && sessionCookieVal) {
      if (timingSafeEqualStr(sessionCookieVal, commission.checkout_token_hash)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Private security clearance token required or invalid." },
        { status: 403 }
      );
    }

    // 3. State Machine Checks
    if (["paid", "in_progress", "revision_requested", "ready_for_delivery", "delivered", "completed", "fulfilled"].includes(commission.status)) {
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
            .eq("id", commissionId).in("status", ["approved", "payment_pending"]);
        }
        return NextResponse.json(
          { success: false, message: "This acquisition window has permanently expired (24-hour limit)." },
          { status: 410 }
        );
      }
    }

    if (commission.status !== "approved" && commission.status !== "payment_pending") {
      return NextResponse.json({ success: false, message: "Commission is not available for checkout." }, { status: 409 });
    }

    if (commission.quote_version > 0 && commission.accepted_quote_version !== commission.quote_version) {
      return NextResponse.json({ success: false, message: "The current quote has not been accepted." }, { status: 409 });
    }

    if (!commission.expires_at) {
      return NextResponse.json({ success: false, message: "Commission quote has no valid expiry." }, { status: 409 });
    }

    // 5. Financial Integrity Check (Strict positive integer paise)
    const pricePaise = commission.price;
    if (!isPositivePaise(pricePaise)) {
      logSecurityFailure(`[ORDER_PRICE_FATAL] Invalid price in database for commission ${commissionId}:`, pricePaise);
      return NextResponse.json(
        { success: false, message: "Commission pricing is uninitialized or invalid." },
        { status: 400 }
      );
    }


    // A retry must use the single order already attached to this quote.
    if (commission.razorpay_order_id) {
      const existingOrder = await razorpay.orders.fetch(commission.razorpay_order_id);
      if (existingOrder.amount !== pricePaise || existingOrder.currency !== commission.currency) {
        return NextResponse.json({ success: false, message: "Stored order does not match the accepted quote." }, { status: 409 });
      }
      return NextResponse.json({ success: true, orderId: commission.razorpay_order_id, amount: pricePaise, currency: "INR" });
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

    // Ledger row and commission order are attached in one database transaction.
    const { data: attachedOrderId, error: attachError } = await supabaseAdmin.rpc("attach_commission_order", {
      p_commission_id: commissionId, p_order_id: order.id, p_amount: pricePaise, p_currency: "INR",
    });
    if (attachError || !attachedOrderId) {
      logSecurityFailure("[ORDER_ATTACH_ERROR]", attachError);
      return NextResponse.json({ success: false, message: "Checkout order could not be recorded. Please retry." }, { status: 503 });
    }
    if (attachedOrderId !== order.id) {
      const winner = await razorpay.orders.fetch(attachedOrderId);
      if (winner.amount !== pricePaise || winner.currency !== "INR") {
        return NextResponse.json({ success: false, message: "Concurrent order mismatch." }, { status: 409 });
      }
      return NextResponse.json({ success: true, orderId: attachedOrderId, amount: pricePaise, currency: "INR" });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: pricePaise, // In paise
      currency: "INR",
    });
  } catch (error) {
    logSecurityFailure("[CREATE_ORDER_FATAL]", error);
    return NextResponse.json(
      { success: false, message: "Secure transaction could not be initialized." },
      { status: 500 }
    );
  }
}
