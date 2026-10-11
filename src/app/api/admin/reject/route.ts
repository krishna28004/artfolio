import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/features/admin/utils/auth";

// The commission-action route records declines in the customer timeline and
// retryable notification queue. Keep this old URL from mutating state alone.
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: "Owner access required." }, { status: 401 });
  }
  return NextResponse.json({ success: false,
    message: "Use the commission detail page to decline an inquiry." }, { status: 410 });
}
