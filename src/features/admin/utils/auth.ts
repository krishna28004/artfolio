import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { timingSafeEqualStr } from "@/shared/utils/crypto";

export interface AdminAuthResult {
  authorized: boolean;
  userEmail?: string;
  source?: "session" | "api_key";
  error?: string;
}

/**
 * Server-side authorization verifier for administrative actions.
 * Every privileged route must independently call this verifier.
 *
 * Verifies either:
 * 1. An authenticated Supabase session where the user email matches the authorized admin identity,
 *    or where server-assigned app_metadata.role === 'admin' (NEVER client-writable user_metadata).
 * 2. A secure server-to-server header (x-admin-key, x-admin-secret, or Bearer token)
 *    matching ADMIN_API_SECRET / ADMIN_API_KEY verified in constant time.
 */
export async function verifyAdminAuth(req?: NextRequest): Promise<AdminAuthResult> {
  const adminEmail = (
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "artist@artfolio.luxury"
  ).toLowerCase().trim();

  // 1. Check API Key Header (if request object is provided)
  if (req) {
    const adminKeyHeader =
      req.headers.get("x-admin-key") ||
      req.headers.get("x-admin-secret") ||
      (req.headers.get("authorization")?.startsWith("Bearer ")
        ? req.headers.get("authorization")!.slice(7)
        : null);

    const configuredSecret = process.env.ADMIN_API_SECRET || process.env.ADMIN_API_KEY;

    if (configuredSecret && adminKeyHeader && timingSafeEqualStr(adminKeyHeader, configuredSecret)) {
      return { authorized: true, userEmail: adminEmail, source: "api_key" };
    }
  }

  // 2. Check Supabase Authenticated Session
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email) {
      return { authorized: false, error: "Unauthenticated: No active admin session found." };
    }

    const sessionEmail = user.email.toLowerCase().trim();

    // Verify authorized admin identity or server-assigned app_metadata role ONLY.
    // user_metadata is client-writable upon registration and must NEVER be trusted for authorization.
    const isAuthorizedEmail = sessionEmail === adminEmail;
    const isAuthorizedRole = user.app_metadata?.role === "admin";

    if (!isAuthorizedEmail && !isAuthorizedRole) {
      return {
        authorized: false,
        error: `Forbidden: Identity '${sessionEmail}' is not in the authorized admin allowlist.`,
      };
    }

    return { authorized: true, userEmail: sessionEmail, source: "session" };
  } catch (err) {
    return { authorized: false, error: `Authentication check failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
