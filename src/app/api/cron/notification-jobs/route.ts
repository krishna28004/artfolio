import { logSecurityFailure } from "@/shared/utils/security-log";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualStr } from "@/shared/utils/crypto";
import { deliverPendingNotifications } from "@/features/commission/server/notifications";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!secret || !timingSafeEqualStr(secret, bearer)) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const result = await deliverPendingNotifications();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logSecurityFailure("[NOTIFICATION_CRON_ERROR]", error);
    return NextResponse.json({ success: false, message: "Notification delivery failed." }, { status: 503 });
  }
}
