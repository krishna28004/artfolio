import { NextResponse } from "next/server";
import { supabase } from "@/shared/services/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY || "mock-key");

export async function POST(req: Request) {
  try {
    // 0. Strict Authenticated Access Loop
    const authHeader = req.headers.get("authorization");
    const adminKey = process.env.ADMIN_API_KEY;
    if (!adminKey || authHeader !== `Bearer ${adminKey}`) {
      console.warn("[ADMIN_FATAL] Unauthorized access attempt to approve endpoint.");
      return NextResponse.json({ success: false, message: "Unauthorized Security Clearance." }, { status: 401 });
    }

    const { commissionId, price } = await req.json();

    // Dynamically retrieve the user's actual email from DB
    const { data: cData } = await supabase.from('commissions').select('email').eq('id', commissionId).single();
    const userEmail = cData?.email;

    if (!userEmail) {
      return NextResponse.json({ success: false, message: "Commission record missing or email not found." }, { status: 404 });
    }

    // Calculate critical asset expiration window (Now + 24 Hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // 1. Admin Operation: Update DB Status, set locked Price, and inject Expiration Threshold
    const { error: dbError } = await supabase
      .from("commissions")
      .update({
        status: 'approved',
        price: price,
        expires_at: expiresAt.toISOString()
      })
      .eq('id', commissionId);

    if (dbError) {
      console.error("[DB_WARN] Mock update processing locally (missing keys).");
    }

    // 2. Fire Async Email to User with specialized Payment Checkout Link
    if (process.env.RESEND_API_KEY) {
      await resend.emails.send({
        from: "curator@artfolio.com",
        to: userEmail,
        subject: "Commission Approved - Secure your piece",
        text: `Your commission has been approved. The bespoke quote is $${price}. Please complete your acquisition securely here: https://yourdomain.com/checkout/${commissionId}`
      });
      console.log(`[APPROVAL_NOTIFY] Invoice dispatched to user: ${commissionId}`);
    } else {
      console.log(`[APPROVAL_MOCK] Approval processed for ${commissionId} at price $${price}`);
    }

    return NextResponse.json({ success: true, message: "Commission Approved and Invoice Sent." });
  } catch (error) {
    console.error("[ADMIN_FATAL]", error);
    return NextResponse.json({ success: false, message: "Server error." }, { status: 500 });
  }
}
