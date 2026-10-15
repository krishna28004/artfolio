import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const recovery = request.nextUrl.searchParams.get("next") === "/auth/reset-password";
  const destination = new URL(recovery ? "/auth/reset-password" : "/admin/login", request.url);
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    destination.searchParams.set("error", "oauth");
    return NextResponse.redirect(destination, { headers: { "Cache-Control": "no-store" } });
  }
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const owner = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (userError || !owner || !user?.email_confirmed_at || user.email?.trim().toLowerCase() !== owner) {
      await supabase.auth.signOut({ scope: "local" });
      destination.searchParams.set("error", "unauthorized");
    } else {
      if (!recovery) destination.searchParams.set("oauth", "1");
    }
  } catch {
    destination.searchParams.set("error", "oauth");
  }
  return NextResponse.redirect(destination, { headers: { "Cache-Control": "no-store" } });
}
