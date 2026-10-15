import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Resend } from "resend";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

const noStore = { "Cache-Control": "private, no-store" };

async function expiry(sessionId: string, userId: string) {
  const { data, error } = await getSupabaseAdmin().rpc("owner_session_expires_at", {
    p_session_id: sessionId, p_user_id: userId,
  });
  if (error || !data || Date.parse(data) <= Date.now()) throw new Error("Studio session expired");
  return data;
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized || !auth.sessionId || !auth.userId) {
    return NextResponse.json({ success: false }, { status: 401, headers: noStore });
  }
  try {
    return NextResponse.json({ success: true, expiresAt: await expiry(auth.sessionId, auth.userId) }, { headers: noStore });
  } catch {
    return NextResponse.json({ success: false }, { status: 401, headers: noStore });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req, { requireLoginAlert: false });
  if (!auth.authorized || !auth.sessionId || !auth.userId) {
    return NextResponse.json({ success: false }, { status: 401, headers: noStore });
  }
  try {
    const expiresAt = await expiry(auth.sessionId, auth.userId);
    const admin = getSupabaseAdmin();
    const { data: existing, error: lookupError } = await admin.from("owner_login_alerts")
      .select("session_id").eq("session_id", auth.sessionId).eq("user_id", auth.userId).maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) {
      const recipient = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
      const from = process.env.RESEND_FROM_EMAIL;
      const key = process.env.RESEND_API_KEY;
      if (!recipient || !from || !key) throw new Error("Studio login email is not configured");
      const sent = await new Resend(key).emails.send({
        from, to: recipient, subject: "Artfolio Studio sign-in",
        text: `A curator completed GitHub or password sign-in and authenticator verification for Artfolio Studio. This Studio session expires at ${expiresAt}.\n\nIf this was not you, revoke the session in Supabase Auth immediately.`,
      }, { idempotencyKey: `studio-login-${createHash("sha256").update(auth.sessionId).digest("hex")}` });
      if (sent.error || !sent.data) throw new Error("Studio login email failed");
      const { error: insertError } = await admin.from("owner_login_alerts").insert({
        session_id: auth.sessionId, user_id: auth.userId,
      });
      if (insertError && insertError.code !== "23505") throw insertError;
    }
    return NextResponse.json({ success: true, expiresAt }, { headers: noStore });
  } catch {
    return NextResponse.json({ success: false, message: "Studio login could not be completed. Check email delivery configuration." },
      { status: 503, headers: noStore });
  }
}
