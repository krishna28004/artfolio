import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { computeHmacSha256, timingSafeEqualStr } from "@/shared/utils/crypto";
import { formatRupees } from "@/shared/utils/money";
import { Resend } from "resend";

const verifySchema = z.object({
  commissionId: z.string().uuid("Invalid commission ID format."),
  razorpay_order_id: z.string().min(1, "Missing Razorpay order ID."),
  razorpay_payment_id: z.string().min(1, "Missing Razorpay payment ID."),
  razorpay_signature: z.string().min(1, "Missing Razorpay signature."),
});

export async function POST(req: Request) {
  try {
    const rawBody = await req.json();
    const parseResult = verifySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: "Invalid verification payload.", errors: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { commissionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = parseResult.data;

    // 1. Secret Key Safety Check
    const secret = process.env.RAZORPAY_SECRET;
    if (!secret) {
      console.error("[VERIFY_SECRET_FATAL] RAZORPAY_SECRET is not configured on the server.");
      return NextResponse.json(
        { success: false, message: "Payment verification service is currently misconfigured." },
        { status: 500 }
      );
    }

    // 2. Cryptographic HMAC SHA256 Constant-Time Verification
    const expectedSignature = computeHmacSha256(
      `${razorpay_order_id}|${razorpay_payment_id}`,
      secret
    );

    if (!timingSafeEqualStr(expectedSignature, razorpay_signature)) {
      console.warn(
        `[VERIFY_TAMPER_WARN] Signature mismatch for commission ${commissionId}. Possible client-side tampering.`
      );
      return NextResponse.json(
        { success: false, message: "Invalid payment signature. Verification rejected." },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    // 3. Authoritative DB State Lookup via Service Role Client
    const { data: commission, error: lookupError } = await supabaseAdmin
      .from("commissions")
      .select("id, status, price, email, name, expires_at, razorpay_order_id, razorpay_payment_id")
      .eq("id", commissionId)
      .single();

    if (lookupError || !commission) {
      console.error("[VERIFY_DB_ERROR] Commission lookup failed during verification:", lookupError);
      return NextResponse.json(
        { success: false, message: "Commission record not found." },
        { status: 404 }
      );
    }

    // 4. Order ID Association Cross-Check
    if (commission.razorpay_order_id && commission.razorpay_order_id !== razorpay_order_id) {
      console.error(
        `[VERIFY_ORDER_MISMATCH] Expected order ${commission.razorpay_order_id} but received ${razorpay_order_id}`
      );
      return NextResponse.json(
        { success: false, message: "Payment does not correspond to the approved order." },
        { status: 400 }
      );
    }

    // 5. Expiration Check
    if (commission.expires_at && new Date() > new Date(commission.expires_at)) {
      if (commission.status !== "paid" && commission.status !== "fulfilled") {
        await supabaseAdmin.from("commissions").update({ status: "expired" }).eq("id", commissionId);
        return NextResponse.json(
          { success: false, message: "This acquisition window has permanently expired." },
          { status: 410 }
        );
      }
    }

    // 6. Idempotency: If already recorded as paid, succeed safely
    if (commission.status === "paid" || commission.status === "fulfilled") {
      return NextResponse.json({
        success: true,
        message: "Payment previously verified and recorded.",
      });
    }

    // 7. State Machine: Must be approved or payment_pending
    if (commission.status !== "approved" && commission.status !== "payment_pending") {
      return NextResponse.json(
        { success: false, message: `Cannot verify payment for commission in '${commission.status}' state.` },
        { status: 400 }
      );
    }

    // 8. Atomic DB State Transition to 'paid' & Revoke Checkout Token
    const nowIso = new Date().toISOString();
    const { error: updateError, data: updatedRecord } = await supabaseAdmin
      .from("commissions")
      .update({
        status: "paid",
        razorpay_order_id,
        razorpay_payment_id,
        checkout_token_hash: null, // Revoke checkout token post-payment
        paid_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", commissionId)
      .in("status", ["approved", "payment_pending"])
      .select("id, status, price")
      .single();

    if (updateError || !updatedRecord) {
      // Concurrency check: If a concurrent webhook already marked this commission as paid, succeed idempotently
      const { data: latestCommission } = await supabaseAdmin
        .from("commissions")
        .select("id, status")
        .eq("id", commissionId)
        .single();

      if (latestCommission && (latestCommission.status === "paid" || latestCommission.status === "fulfilled")) {
        console.info(`[VERIFY_RACE_RESOLVED] Commission ${commissionId} already marked as paid by concurrent webhook.`);
        return NextResponse.json({
          success: true,
          message: "Payment successfully verified and recorded.",
        });
      }

      console.error("[VERIFY_UPDATE_ERROR] Failed to atomically update commission status to paid:", updateError);
      return NextResponse.json(
        { success: false, message: "Payment verified but database update failed." },
        { status: 500 }
      );
    }

    // 9. Update/Insert in 'payments' Table (Idempotent)
    try {
      const { data: existingPay } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("razorpay_order_id", razorpay_order_id)
        .maybeSingle();

      if (existingPay) {
        await supabaseAdmin
          .from("payments")
          .update({
            razorpay_payment_id,
            status: "captured",
            amount: commission.price || 0,
          })
          .eq("id", existingPay.id);
      } else {
        await supabaseAdmin.from("payments").insert({
          commission_id: commissionId,
          razorpay_order_id,
          razorpay_payment_id,
          amount: commission.price || 0,
          currency: "INR",
          status: "captured",
        });
      }
    } catch (payInsertErr) {
      console.warn("[PAYMENT_TABLE_INSERT_WARN]", payInsertErr);
    }

    // 10. Write to Audit Log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        actor: "gateway_verifier",
        action: "payment_captured",
        target_type: "commission",
        target_id: commissionId,
        metadata: {
          razorpay_order_id,
          razorpay_payment_id,
          amountPaise: commission.price,
        },
      });
    } catch (auditErr) {
      console.warn("[AUDIT_LOG_ERROR] Could not log payment capture:", auditErr);
    }

    // 11. Transactional Email Dispatch (Resilient: failure does not rollback DB)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "curator@artfolio.luxury";

        // Collector confirmation email
        if (commission.email) {
          await resend.emails.send({
            from: fromEmail,
            to: commission.email,
            subject: "Acquisition Confirmed — ARTfolio Studio",
            html: `
              <div style="background-color: #0D0D0D; color: #E5E5E5; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #222;">
                <h1 style="color: #D4AF37; font-family: serif; font-size: 28px; margin-bottom: 24px;">Acquisition Secured</h1>
                <p style="font-size: 15px; line-height: 1.6; color: #A3A3A3;">Dear ${commission.name},</p>
                <p style="font-size: 15px; line-height: 1.6; color: #A3A3A3;">
                  Your payment of <strong style="color: #F5F5F5;">${formatRupees(commission.price || 0)} INR</strong> has been captured and verified.
                </p>
                <div style="background-color: #141414; border-left: 2px solid #D4AF37; padding: 20px; margin: 24px 0;">
                  <p style="margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #737373;">Payment Reference</p>
                  <p style="margin: 6px 0 0 0; font-family: monospace; color: #E5E5E5; font-size: 13px;">${razorpay_payment_id}</p>
                </div>
                <p style="font-size: 14px; line-height: 1.6; color: #A3A3A3;">
                  Krishna Kumar has been notified and studio creation has now commenced. You will receive studio progress updates as your original piece develops.
                </p>
                <p style="font-size: 12px; color: #525252; margin-top: 36px;">
                  Krishna Kumar Studio &mdash; ARTfolio Fine Arts
                </p>
              </div>
            `,
          });
        }
      } catch (emailErr) {
        console.warn("[EMAIL_SEND_FAIL] Failed to dispatch payment receipt email:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment successfully verified and recorded.",
    });
  } catch (error) {
    console.error("[VERIFY_FATAL]", error);
    return NextResponse.json(
      { success: false, message: "Server error during payment verification." },
      { status: 500 }
    );
  }
}
