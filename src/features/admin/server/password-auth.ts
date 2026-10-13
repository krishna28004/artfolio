import { NextRequest, NextResponse } from "next/server";
import { createClient as createAuthClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";
import { createHash } from "node:crypto";
import { z } from "zod";

const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), email: z.string().email().max(254), password: z.string().min(1).max(1024) }),
  z.object({ action: z.literal("recover"), email: z.string().email().max(254) }),
  z.object({ action: z.literal("reset"), email: z.string().email().max(254), token: z.string().regex(/^[0-9]{6,10}$/), password: z.string().min(12).max(128) }),
]);
const recoveryMessage = "If this address is eligible, a recovery email will arrive. Enter its recovery code below.";
let sessionFactory = createClient;
let recoveryFactory = () => createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
export function _setAdminLoginClientsForTesting(session: typeof createClient | null, recovery: typeof recoveryFactory | null) {
  sessionFactory = session || createClient;
  recoveryFactory = recovery || (() => createAuthClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }));
}
const reply = (body: object, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function handleAdminPasswordAuth(req: NextRequest) {
  // Require browser same-origin requests before password/session operations.
  if (req.headers.get("origin") !== new URL(req.url).origin) return reply({ error: "Invalid request origin." }, 403);
  const ip = getClientIp(req);
  const gate = await checkDistributedRateLimit("admin-auth:" + ip, 20, 15 * 60_000);
  if (!gate.success) return reply({ error: "Too many attempts. Try again later." }, 429, { "Retry-After": String(Math.max(1, Math.ceil(gate.resetMs / 1000))) });
  if (Number(req.headers.get("content-length")) > 8192) return reply({ error: "Request too large." }, 413);
  let parsed;
  try { parsed = input.safeParse(await req.json()); } catch { return reply({ error: "Invalid request." }, 400); }
  if (!parsed.success) return reply({ error: "Invalid request." }, 400);
  const data = parsed.data;
  const email = data.email.toLowerCase().trim();
  const account = createHash("sha256").update(email).digest("hex");
  const limit = data.action === "recover" ? 3 : 10;
  const window = data.action === "recover" ? 60 * 60_000 : 15 * 60_000;
  for (const key of [ip, account]) {
    const rate = await checkDistributedRateLimit("admin-auth:" + data.action + ":" + key, limit, window);
    if (!rate.success) return reply({ error: "Too many attempts. Try again later." }, 429, { "Retry-After": String(Math.max(1, Math.ceil(rate.resetMs / 1000))) });
  }
  const owner = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  if (!owner) return reply({ error: "Studio sign-in is unavailable." }, 503);
  try {
    if (data.action === "recover") {
      // No browser session is created by recovery; unknown accounts get the same response.
      if (email === owner) {
        const { error } = await recoveryFactory().auth.resetPasswordForEmail(email);
        if (error) console.error("[ADMIN_RECOVERY] Recovery email unavailable.");
      }
      return reply({ message: recoveryMessage }, 202);
    }
    if (email !== owner) return reply({ error: "Unable to verify studio credentials." }, 401);
    if (data.action === "reset") {
      const client = recoveryFactory();
      const { data: verified, error } = await client.auth.verifyOtp({ email, token: data.token, type: "recovery" });
      if (error || verified.user?.email?.toLowerCase().trim() !== owner || !verified.user.email_confirmed_at) {
        await client.auth.signOut({ scope: "local" });
        return reply({ error: "Recovery code is invalid or expired." }, 401);
      }
      const { error: updateError } = await client.auth.updateUser({ password: data.password });
      if (updateError) {
        await client.auth.signOut({ scope: "local" });
        return reply({ error: "Password could not be changed. An enrolled MFA account may require operator recovery." }, 400);
      }
      const { error: revokeError } = await client.auth.signOut({ scope: "global" });
      if (revokeError) return reply({ error: "Password changed, but session revocation needs operator review before sign-in." }, 503);
      return reply({ message: "Password changed. Sign in again with your authenticator." });
    }
    const client = await sessionFactory();
    const { data: signedIn, error } = await client.auth.signInWithPassword({ email, password: data.password });
    if (error || signedIn.user?.email?.toLowerCase().trim() !== owner || !signedIn.user.email_confirmed_at) {
      await client.auth.signOut({ scope: "local" });
      return reply({ error: "Unable to verify studio credentials." }, 401);
    }
    return reply({ success: true });
  } catch {
    if (data.action === "recover") return reply({ message: recoveryMessage }, 202);
    return reply({ error: "Studio sign-in is unavailable. Try again later." }, 503);
  }
}
