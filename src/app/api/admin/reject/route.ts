import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { Resend } from "resend";

const rejectSchema = z.object({
  commissionId: z.string().uuid("Invalid commission ID format."),
  reason: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      const legacyKey = process.env.ADMIN_API_KEY;
      const authHeader = req.headers.get("authorization") || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!legacyKey || bearerToken !== legacyKey) {
        return NextResponse.json(
          { success: false, message: authResult.error || "Unauthorized administrative clearance." },
          { status: 401 }
        );
      }
    }

    const actor = authResult.userEmail || "admin";
    const rawBody = await req.json();
    const parseResult = rejectSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: "Invalid payload.", errors: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { commissionId, reason } = parseResult.data;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: commission, error: lookupError } = await supabaseAdmin
      .from("commissions")
      .select("id, email, name, status")
      .eq("id", commissionId)
      .single();

    if (lookupError || !commission) {
      return NextResponse.json({ success: false, message: "Commission record not found." }, { status: 404 });
    }

    if (commission.status !== "pending") {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot reject commission in '${commission.status}' state. Only 'pending' commissions can be rejected.`,
        },
        { status: 400 }
      );
    }

    // Atomic update
    const { error: updateError, data: updated } = await supabaseAdmin
      .from("commissions")
      .update({
        status: "rejected",
        admin_notes: reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", commissionId)
      .eq("status", "pending")
      .select("id, status")
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ success: false, message: "Failed to update commission record." }, { status: 500 });
    }

    // Audit Log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        actor,
        action: "commission_rejected",
        target_type: "commission",
        target_id: commissionId,
        metadata: { reason: reason || null },
      });
    } catch (auditErr) {
      console.warn("[AUDIT_LOG_ERROR] Could not log rejection:", auditErr);
    }

    // Optional customer notification
    if (process.env.RESEND_API_KEY && commission.email) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const fromEmail = process.env.RESEND_FROM_EMAIL || "curator@artfolio.luxury";

        await resend.emails.send({
          from: fromEmail,
          to: commission.email,
          subject: "Regarding your ARTfolio Commission Inquiry",
          html: `
            <div style="background-color: #0D0D0D; color: #E5E5E5; padding: 40px; font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #222;">
              <h1 style="color: #D4AF37; font-family: serif; font-size: 26px; margin-bottom: 24px;">Commission Inquiry Update</h1>
              <p style="font-size: 15px; line-height: 1.6; color: #A3A3A3;">Dear ${commission.name},</p>
              <p style="font-size: 15px; line-height: 1.6; color: #A3A3A3;">
                Thank you for your interest in commissioning an original pencil drawing. Due to current studio capacity and curatorial scheduling, we are unable to accept your commission at this time.
              </p>
              ${reason ? `<p style="font-size: 14px; line-height: 1.6; color: #737373; font-style: italic;">Studio Note: "${reason}"</p>` : ""}
              <p style="font-size: 14px; line-height: 1.6; color: #A3A3A3; margin-top: 24px;">
                You are warmly invited to explore our current permanent collection and future open studio dates.
              </p>
              <p style="font-size: 12px; color: #525252; margin-top: 36px;">
                Krishna Kumar Studio &mdash; ARTfolio
              </p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.warn("[EMAIL_SEND_FAIL] Failed to send rejection email:", emailErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Commission successfully rejected.",
      data: { commissionId: updated.id, status: updated.status },
    });
  } catch (error) {
    console.error("[ADMIN_REJECT_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
