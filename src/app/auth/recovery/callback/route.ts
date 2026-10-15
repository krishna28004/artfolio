import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const destination = new URL("/auth/reset-password", request.url);
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    destination.searchParams.set("error", "invalid");
    return NextResponse.redirect(destination, { headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" } });
  }

  const supabase = await createClient();
  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const owner = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    if (userError || !owner || !user?.email_confirmed_at || user.email?.trim().toLowerCase() !== owner) {
      await supabase.auth.signOut({ scope: "local" });
      destination.searchParams.set("error", "unauthorized");
    } else {
      destination.searchParams.set("recovery", "1");
    }
  } catch {
    await supabase.auth.signOut({ scope: "local" });
    destination.searchParams.set("error", "invalid");
  }
  return NextResponse.redirect(destination, { headers: { "Cache-Control": "no-store, private", "Referrer-Policy": "no-referrer" } });
}
