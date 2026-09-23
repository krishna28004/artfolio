import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { rupeesToPaise, formatRupees } from "@/shared/utils/money";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { Resend } from "resend";

const approveSchema = z
  .object({
    commissionId: z.string().uuid("Invalid commission ID format."),
    priceInRupees: z
      .number()
      .int("Price must be a whole rupee integer.")
      .positive("Price must be positive.")
      .max(10_000_000, "Price exceeds allowable upper threshold.")
      .optional(),
    price: z
      .number()
      .int("Price must be a whole rupee integer.")
      .positive("Price must be positive.")
      .max(10_000_000, "Price exceeds allowable upper threshold.")
      .optional(),
    adminNotes: z.string().max(1000).optional(),
  })
  .refine((data) => data.priceInRupees !== undefined || data.price !== undefined, {
    message: "Either priceInRupees or price must be specified.",
  });

export async function POST(req: NextRequest) {
  try {
    // 1. Strict Admin Authorization Check
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      // Fallback check: legacy ADMIN_API_KEY Bearer header for backward compatibility
      const legacyKey = process.env.ADMIN_API_KEY;
      const authHeader = req.headers.get("authorization") || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const matchesLegacy = legacyKey && bearerToken && bearerToken === legacyKey;

      if (!matchesLegacy) {
        return NextResponse.json(
          { success: false, message: authResult.error || "Unauthorized administrative clearance." },
          { status: 401 }
        );
      }
    }

    const actor = authResult.userEmail || "admin";

    // 2. Input Validation
    const rawBody = await req.json();
    const parseResult = approveSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: "Invalid payload.", errors: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { commissionId, adminNotes } = parseResult.data;
    const rupeeAmount = parseResult.data.priceInRupees ?? parseResult.data.price!;
    const pricePaise = rupeesToPaise(rupeeAmount);

    const supabaseAdmin = getSupabaseAdmin();

    // 3. Authoritative DB Lookup
    const { data: commission, error: lookupError } = await supabaseAdmin
      .from("commissions")
      .select("id, email, name, status")
      .eq("id", commissionId)
      .single();

    if (lookupError || !commission) {
      return NextResponse.json(
        { success: false, message: "Commission record not found." },
        { status: 404 }
      );
    }

    if (commission.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot approve commission in '${commission.status}' state. Only 'pending' commissions can be approved.`,
        },
        { status: 400 }
      );
    }

    // 4. Calculate 24-Hour Expiration Window
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 5. Generate High-Entropy Private Bearer Token for Secure Checkout
    const rawCheckoutToken = crypto.randomBytes(32).toString("hex");
    const checkoutTokenHash = crypto.createHash("sha256").update(rawCheckoutToken).digest("hex");

    // 6. Atomic DB State Transition: pending -> approved
    const { error: updateError, data: updatedData } = await supabaseAdmin
      .from("commissions")
      .update({
        status: "approved",
        price: pricePaise,
        currency: "INR",
        expires_at: expiresAt.toISOString(),
        checkout_token_hash: checkoutTokenHash,
        admin_notes: adminNotes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commissionId)
      .eq("status", "pending")
      .select("id, status, price, expires_at")
      .single();

    if (updateError || !updatedData) {
      console.error("[ADMIN_DB_ERROR] Failed to update commission status atomically:", updateError);
      return NextResponse.json(
        { success: false, message: "Failed to update commission record. Concurrent modification detected." },
        { status: 500 }
      );
    }

    // 7. Write to Audit Log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        actor,
        action: "commission_approved",
        target_type: "commission",
        target_id: commissionId,
        metadata: {
          pricePaise,
          formattedPrice: formatRupees(pricePaise),
          expiresAt: expiresAt.toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn("[AUDIT_LOG_ERROR] Could not write approval audit log:", auditErr);
    }

    // 8. Generate Private Bearer Token Checkout Link
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || req.headers.get("origin") || "http://localhost:3000";
    const checkoutUrl = `${baseUrl.replace(/\/+$/, "")}/checkout/${commissionId}?token=${rawCheckoutToken}`;

    // 9. Dispatch Transactional Email Notification
    let emailSent = false;
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "curator@artfolio.luxury";

        await resend.emails.send({
          from: fromEmail,
          to: commission.email,
          subject: "Your ARTfolio Commission Has Been Approved",
          html: `
            <div style="background-color: #0D0D0D; color: #E5E5E5; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #222;">
              <h1 style="color: #D4AF37; font-family: serif; font-size: 28px; margin-bottom: 24px;">Commission Approved</h1>
              <p style="font-size: 15px; line-height: 1.6; color: #A3A3A3;">Dear ${commission.name},</p>
              <p style="font-size: 15px; line-height: 1.6; color: #A3A3A3;">
                Krishna Kumar has reviewed your bespoke inquiry and approved the commission.
              </p>
              <div style="background-color: #141414; border-left: 2px solid #D4AF37; padding: 20px; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.15em; color: #737373;">Quoted Honorarium</p>
                <p style="margin: 8px 0 0 0; font-size: 26px; font-family: serif; color: #F5F5F5;">${formatRupees(pricePaise)} <span style="font-size: 14px; color: #A3A3A3;">INR</span></p>
                <p style="margin: 8px 0 0 0; font-size: 12px; color: #E08244;">Expiration: Valid for 24 hours</p>
              </div>
              <p style="font-size: 14px; line-height: 1.6; color: #A3A3A3;">
                To reserve your studio creation slot and initialize acquisition, please complete the secure checkout below using your private link:
              </p>
              <div style="margin: 32px 0;">
                <a href="${checkoutUrl}" style="background-color: #D4AF37; color: #0D0D0D; padding: 14px 32px; font-weight: 600; text-decoration: none; text-transform: uppercase; font-size: 12px; letter-spacing: 0.15em; display: inline-block;">
                  Complete Acquisition Securely &rarr;
                </a>
              </div>
              <p style="font-size: 12px; color: #525252; margin-top: 36px;">
                This link contains a private security token. Do not share it publicly.
              </p>
            </div>
          `,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("[EMAIL_DISPATCH_FAIL] Could not send approval email:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Commission approved successfully for ${formatRupees(pricePaise)}.`,
      data: {
        commissionId: updatedData.id,
        pricePaise: updatedData.price,
        formattedPrice: formatRupees(pricePaise),
        expiresAt: updatedData.expires_at,
        checkoutUrl,
        emailSent,
      },
    });
  } catch (error) {
    console.error("[ADMIN_APPROVE_FATAL]", error);
    return NextResponse.json(
      { success: false, message: "Server encountered an internal error." },
      { status: 500 }
    );
  }
}
