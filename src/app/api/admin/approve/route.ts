import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/features/admin/utils/auth";

// This legacy endpoint cannot collect scope, terms, or customer acceptance.
// Keep its URL closed so it cannot bypass the quote workflow.
export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) {
    return NextResponse.json({ success: false, message: "Owner access required." }, { status: 401 });
  }
  return NextResponse.json({
    success: false,
    message: "Use the commission detail page to send a complete quote for customer acceptance.",
  }, { status: 410 });
}
