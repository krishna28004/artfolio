import { NextRequest, NextResponse } from "next/server";
import { COMMISSION_VERIFICATION_COOKIE } from "@/features/commission/server/email-verification";

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  const response = NextResponse.json({ success: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(COMMISSION_VERIFICATION_COOKIE, "", {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0,
  });
  return response;
}
