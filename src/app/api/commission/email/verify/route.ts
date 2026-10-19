import { NextRequest, NextResponse } from "next/server";
import { consumeCommissionChallenge, getCommissionEmailRedis } from "@/features/commission/server/email-challenge-store";
import { commissionEmailDigest, createCommissionVerification, COMMISSION_VERIFICATION_COOKIE, COMMISSION_VERIFICATION_SECONDS, normalizedCommissionEmail } from "@/features/commission/server/email-verification";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403, headers: noStore });
  }
  const body = await request.json().catch(() => null);
  const email = normalizedCommissionEmail(body?.email);
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const challengeId = typeof body?.challengeId === "string" ? body.challengeId : "";
  if (!email || !/^\d{6}$/.test(code) || !/^[0-9a-f-]{36}$/.test(challengeId)) {
    return NextResponse.json({ success: false, message: "Enter the six-digit code from your message." }, { status: 400, headers: noStore });
  }
  const redis = getCommissionEmailRedis();
  if (!redis || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ success: false, message: "Email verification is not configured yet." }, { status: 503, headers: noStore });
  }
  try {
    const [ipLimit, emailLimit] = await Promise.all([
      checkDistributedRateLimit(`commission_email_verify_ip:${getClientIp(request)}`, 15, 15 * 60 * 1000),
      checkDistributedRateLimit(`commission_email_verify_address:${commissionEmailDigest(email)}`, 8, 15 * 60 * 1000),
    ]);
    if (!ipLimit.success || !emailLimit.success) {
      return NextResponse.json({ success: false, message: "Too many attempts. Please request a new code later." }, { status: 429, headers: noStore });
    }
    // GETDEL consumes the code atomically, so a code can only be tried once.
    if (!(await consumeCommissionChallenge(redis, challengeId, email, code))) {
      return NextResponse.json({ success: false, message: "The code is invalid or expired. Request a new code and try again." }, { status: 401, headers: noStore });
    }
    const marker = createCommissionVerification(email);
    if (!marker) throw new Error("Email proof signing unavailable");
    const response = NextResponse.json({ success: true }, { headers: noStore });
    response.cookies.set(COMMISSION_VERIFICATION_COOKIE, marker, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/",
      maxAge: COMMISSION_VERIFICATION_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ success: false, message: "Verification is unavailable right now. Please try again." }, { status: 503, headers: noStore });
  }
}
