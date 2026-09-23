import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { timingSafeEqualStr } from "@/shared/utils/crypto";

const validateCheckoutSchema = z.object({
  commissionId: z.string().uuid("Invalid commission ID format."),
  token: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parseResult = validateCheckoutSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: "Invalid payload.", errors: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { commissionId, token } = parseResult.data;
    const supabaseAdmin = getSupabaseAdmin();

    const { data: commission, error } = await supabaseAdmin
      .from("commissions")
      .select("id, name, email, size, budget, price, currency, status, expires_at, checkout_token_hash")
      .eq("id", commissionId)
      .single();

    if (error || !commission) {
      return NextResponse.json(
        { success: false, message: "Acquisition record could not be found." },
        { status: 404 }
      );
    }

    // Secure Bearer Token Verification:
    // If a token hash is stored, the request must provide a valid secret
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
          { success: false, message: "Invalid or tampered acquisition access token." },
          { status: 403 }
        );
      }
    }

    // Expiration validation
    if (commission.expires_at && new Date() > new Date(commission.expires_at)) {
      if (commission.status !== "expired" && commission.status !== "paid" && commission.status !== "fulfilled") {
        await supabaseAdmin.from("commissions").update({ status: "expired" }).eq("id", commissionId);
      }
      return NextResponse.json(
        { success: false, status: "expired", message: "This exclusive 24-hour acquisition window has expired." },
        { status: 410 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: commission.id,
        name: commission.name,
        size: commission.size,
        budget: commission.budget,
        price: commission.price,
        currency: commission.currency || "INR",
        status: commission.status,
        expires_at: commission.expires_at,
      },
    });
  } catch (error) {
    console.error("[CHECKOUT_VALIDATE_FATAL]", error);
    return NextResponse.json({ success: false, message: "Server error validating token." }, { status: 500 });
  }
}
