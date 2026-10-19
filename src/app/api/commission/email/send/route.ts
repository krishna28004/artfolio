import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getCommissionEmailRedis } from "@/features/commission/server/email-challenge-store";
import { COMMISSION_CHALLENGE_SECONDS, commissionChallengeDigest, commissionChallengeKey, commissionEmailDigest, normalizedCommissionEmail } from "@/features/commission/server/email-verification";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403, headers: noStore });
  }
  const body = await request.json().catch(() => null);
  const email = normalizedCommissionEmail(body?.email);
  if (!email) return NextResponse.json({ success: false, message: "Enter a valid email address." }, { status: 400, headers: noStore });
  const redis = getCommissionEmailRedis();
  const from = process.env.RESEND_FROM_EMAIL;
  const key = process.env.RESEND_API_KEY;
  if (!redis || !from || !key || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ success: false, message: "Email verification is not configured yet." }, { status: 503, headers: noStore });
  }
  try {
    const [ipLimit, emailLimit] = await Promise.all([
      checkDistributedRateLimit(`commission_email_send_ip:${getClientIp(request)}`, 8, 60 * 60 * 1000),
      checkDistributedRateLimit(`commission_email_send_address:${commissionEmailDigest(email)}`, 3, 15 * 60 * 1000),
    ]);
    if (!ipLimit.success || !emailLimit.success) {
      return NextResponse.json({ success: false, message: "Too many code requests. Please try again later." }, { status: 429, headers: noStore });
    }
    const challengeId = crypto.randomUUID();
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
    const digest = commissionChallengeDigest(challengeId, email, code);
    if (!digest) throw new Error("Email code signing unavailable");
    await redis.set(commissionChallengeKey(challengeId), digest, { ex: COMMISSION_CHALLENGE_SECONDS });
    try {
      const sent = await new Resend(key).emails.send({
        from, to: email, subject: "Your Artfolio commission code",
        text: `Enter this one-time code on the Artfolio commission page: ${code}\n\nThe code expires in 10 minutes and can be used once. If you did not request it, you can ignore this email.`,
      }, { idempotencyKey: `commission-email-${challengeId}` });
      if (sent.error || !sent.data) throw new Error("Email provider rejected the request");
    } catch {
      await redis.del(commissionChallengeKey(challengeId)).catch(() => undefined);
      throw new Error("Email provider rejected the request");
    }
    return NextResponse.json({ success: true, challengeId }, { headers: noStore });
  } catch {
    return NextResponse.json({ success: false, message: "We could not send a code right now. Please try again later." }, { status: 503, headers: noStore });
  }
}
