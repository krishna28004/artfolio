import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

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
 * 1. An authenticated Supabase session where the user email matches the authorized admin identity.
 * 2. A secure server-to-server x-admin-key header matching ADMIN_API_SECRET (for internal tasks/tests).
 */
export async function verifyAdminAuth(req?: NextRequest): Promise<AdminAuthResult> {
  const adminEmail = (
    process.env.ADMIN_NOTIFICATION_EMAIL ||
    process.env.ADMIN_EMAIL ||
    "artist@artfolio.luxury"
  ).toLowerCase().trim();

  // 1. Check API Key Header (if request object is provided)
  if (req) {
    const adminKeyHeader = req.headers.get("x-admin-key") || req.headers.get("x-admin-secret");
    const configuredSecret = process.env.ADMIN_API_SECRET;

    if (configuredSecret && adminKeyHeader && adminKeyHeader === configuredSecret) {
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

    // Verify authorized admin identity or admin role metadata
    const isAuthorizedEmail = sessionEmail === adminEmail;
    const isAuthorizedRole = user.app_metadata?.role === "admin" || user.user_metadata?.role === "admin";

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
