import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const recoverySchema = z.object({
  email: z.string().trim().email().max(254),
  token: z.string().trim().regex(/^\d{6,8}$/),
});

const noStore = {
  "Cache-Control": "no-store, private",
  "Referrer-Policy": "no-referrer",
};

let recoveryClientFactory: typeof createClient = createClient;

export function _setRecoveryClientFactoryForTesting(factory: typeof createClient | null) {
  recoveryClientFactory = factory || createClient;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ success: false, message: "Invalid request origin." }, { status: 403, headers: noStore });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "Enter the curator email and recovery code from the latest message." }, { status: 400, headers: noStore });
  }

  const parsed = recoverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: "Enter a valid curator email and the recovery code from the latest message." }, { status: 400, headers: noStore });
  }

  const owner = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!owner) {
    return NextResponse.json({ success: false, message: "Studio recovery is not configured. Contact the site administrator." }, { status: 503, headers: noStore });
  }

  const supabase = await recoveryClientFactory();
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: "recovery",
  });

  if (error || !data.user) {
    return NextResponse.json({ success: false, message: "That recovery code is invalid, expired, or already used. Request a new email and enter its code." }, { status: 400, headers: noStore });
  }

  const verifiedEmail = data.user.email?.trim().toLowerCase();
  if (verifiedEmail !== owner || !data.user.email_confirmed_at) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.json({ success: false, message: "This account is not the authorized Studio curator." }, { status: 403, headers: noStore });
  }

  return NextResponse.json({ success: true }, { headers: noStore });
}
