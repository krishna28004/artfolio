import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { timingSafeEqualStr } from "@/shared/utils/crypto";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

let authClientFactory: typeof createClient = createClient;
export function _setAuthClientFactoryForTesting(factory: typeof createClient | null) {
  authClientFactory = factory || createClient;
}

export interface AdminAuthResult {
  authorized: boolean;
  userEmail?: string;
  userId?: string;
  sessionId?: string;
  source?: "session" | "api_key";
  error?: string;
}

/**
 * Server-side authorization verifier for administrative actions.
 * Every privileged route must independently call this verifier.
 * MFA and active-session checks are the default; password-only access is
 * reserved for the login authorization bootstrap, which returns no private data.
 *
 * Verifies either:
 * 1. An authenticated Supabase session whose verified email matches the configured owner.
 * 2. A secure server-to-server header (x-admin-key, x-admin-secret, or Bearer token)
 *    matching ADMIN_API_SECRET / ADMIN_API_KEY verified in constant time.
 */
export async function verifyAdminAuth(req?: NextRequest, options: { requireMfa?: boolean; requireLoginAlert?: boolean } = {}): Promise<AdminAuthResult> {
  const adminEmail = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
  if (!adminEmail) return { authorized: false, error: "Owner identity is not configured." };

  // Enforce browser origin even when a server credential header is present.
  if (req && !["GET", "HEAD"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && origin !== new URL(req.url).origin) return { authorized: false, error: "Invalid request origin." };
  }
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
    const supabase = await authClientFactory();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || !user.email || !user.email_confirmed_at) {
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

    if (options.requireMfa !== false) {
      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError || assurance?.currentLevel !== "aal2") {
        return { authorized: false, error: "A verified MFA session is required for this action." };
      }
    }
    // A signed access JWT can outlive logout. Require its session row to still exist.
    const { data: verifiedClaims, error: claimsError } = await supabase.auth.getClaims();
    const claims = verifiedClaims?.claims;
    const sessionId = claims?.session_id;
    if (claimsError || (options.requireMfa !== false && claims?.aal !== "aal2") || claims?.sub !== user.id || typeof sessionId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
      return { authorized: false, error: "An active owner session is required for this action." };
    }
    const { data: active, error: sessionError } = await getSupabaseAdmin().rpc("is_owner_session_active", {
      p_session_id: sessionId, p_user_id: user.id,
    });
    if (sessionError || active !== true) {
      return { authorized: false, error: "Owner session was revoked or could not be verified." };
    }

    // The MFA bootstrap and login-completion endpoint are the only routes that
    // can run before the per-session login alert has been delivered.
    if (options.requireMfa !== false && options.requireLoginAlert !== false) {
      const { data: alert, error: alertError } = await getSupabaseAdmin()
        .from("owner_login_alerts").select("session_id")
        .eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
      if (alertError || !alert) {
        return { authorized: false, error: "Studio login notification is not complete." };
      }
    }

    return { authorized: true, userEmail: sessionEmail, userId: user.id, sessionId, source: "session" };
  } catch {
    return { authorized: false, error: "Authentication check unavailable." };
  }
}
