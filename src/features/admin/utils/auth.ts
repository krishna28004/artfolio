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
 * 1. An authenticated Supabase session whose verified email matches the configured owner.
 * 2. A secure server-to-server header (x-admin-key, x-admin-secret, or Bearer token)
 *    matching ADMIN_API_SECRET / ADMIN_API_KEY verified in constant time.
 */
export async function verifyAdminAuth(req?: NextRequest): Promise<AdminAuthResult> {
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  if (!adminEmail) return { authorized: false, error: "Owner identity is not configured." };

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

    // Only the configured owner identity may use this single-artist portal.
    const isAuthorizedEmail = sessionEmail === adminEmail;

    if (!isAuthorizedEmail) {
      return {
        authorized: false,
        error: "Forbidden: this account is not the configured owner.",
      };
    }

    return { authorized: true, userEmail: sessionEmail, source: "session" };
  } catch (err) {
    return { authorized: false, error: `Authentication check failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}
