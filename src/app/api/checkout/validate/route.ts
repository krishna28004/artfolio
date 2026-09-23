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

    // 1. Strict Bearer Token / Session Authorization Check
    // A commission in checkout MUST have an active checkout_token_hash.
    // NULL token hash in DB NEVER bypasses verification.
    if (!commission.checkout_token_hash) {
      return NextResponse.json(
        { success: false, message: "No active checkout authorization found for this commission." },
        { status: 403 }
      );
    }

    const sessionCookieName = `checkout_session_${commissionId}`;
    const sessionCookieVal = req.cookies.get(sessionCookieName)?.value;

    let isAuthorized = false;
    let computedHash = "";

    if (token) {
      computedHash = crypto.createHash("sha256").update(token).digest("hex");
      if (timingSafeEqualStr(computedHash, commission.checkout_token_hash)) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && sessionCookieVal) {
      if (timingSafeEqualStr(sessionCookieVal, commission.checkout_token_hash)) {
        isAuthorized = true;
        computedHash = sessionCookieVal;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { success: false, message: "Private security clearance token required or invalid." },
        { status: 403 }
      );
    }

    // 2. State Machine Checks (Only executed AFTER successful authorization)
    if (commission.status === "paid" || commission.status === "fulfilled") {
      return NextResponse.json(
        { success: false, message: "Commission has already been paid and finalized. Checkout authorization is no longer valid." },
        { status: 409 }
      );
    }

    if (commission.status === "pending") {
      return NextResponse.json(
        { success: false, message: "Commission inquiry is pending curatorial review and has not been approved." },
        { status: 400 }
      );
    }

    if (commission.status === "rejected" || commission.status === "cancelled") {
      return NextResponse.json(
        { success: false, message: `This commission has been ${commission.status}.` },
        { status: 400 }
      );
    }

    // 4. Expiration validation
    if (commission.expires_at && new Date() > new Date(commission.expires_at)) {
      await supabaseAdmin.from("commissions").update({ status: "expired" }).eq("id", commissionId);
      return NextResponse.json(
        { success: false, status: "expired", message: "This exclusive 24-hour acquisition window has expired." },
        { status: 410 }
      );
    }

    // 5. Establish short-lived HttpOnly session cookie to avoid exposing raw token in subsequent calls
    const response = NextResponse.json({
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

    response.cookies.set({
      name: sessionCookieName,
      value: computedHash,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[CHECKOUT_VALIDATE_FATAL]", error);
    return NextResponse.json({ success: false, message: "Server error validating token." }, { status: 500 });
  }
}
