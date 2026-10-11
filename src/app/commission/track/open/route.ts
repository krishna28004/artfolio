import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";
import { timingSafeEqualStr } from "@/shared/utils/crypto";
import { accessCookieName, hashAccessToken } from "@/features/commission/server/customer-access";

export async function GET(req: NextRequest) {
  const limit = await checkDistributedRateLimit(`tracking_open_${getClientIp(req)}`, 15, 15 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ message: "Too many attempts." }, { status: 429 });
  const id = req.nextUrl.searchParams.get("id") || "";
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return NextResponse.redirect(new URL("/commission?tracking=invalid", req.url));
  }
  const hash = hashAccessToken(token);
  const { data } = await getSupabaseAdmin().from("commissions")
    .select("tracking_token_hash").eq("id", id).maybeSingle();
  if (!data?.tracking_token_hash || !timingSafeEqualStr(hash, data.tracking_token_hash)) {
    return NextResponse.redirect(new URL("/commission?tracking=invalid", req.url));
  }
  const response = NextResponse.redirect(new URL(`/commission/track/${id}`, req.url));
  response.cookies.set(accessCookieName(id), hash, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, path: "/",
  });
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Cache-Control", "no-store");
  return response;
}
