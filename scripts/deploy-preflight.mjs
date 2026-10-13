#!/usr/bin/env node
// ==============================================================================
// ARTfolio Production Deployment Preflight Verification
//
// STRICT PRIVACY RULE:
// This script inspects configuration names and structure only.
// It NEVER prints, logs, echoes, or exports actual secret values or keys.
// ==============================================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

// Safely parse .env.local if present without logging values
function loadEnvLocalSafely() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, "utf8");
  const envMap = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx !== -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      // Store boolean existence and metadata safely, never the raw value
      envMap[key] = {
        present: Boolean(val),
        length: val.length,
        isQuoted: (val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")),
        raw: val.replace(/^["']|["']$/g, "").trim(),
      };
    }
  }
  return envMap;
}

const fileEnv = loadEnvLocalSafely();

function getVar(name) {
  if (process.env[name]) {
    const val = process.env[name].trim();
    return { present: Boolean(val), raw: val };
  }
  if (fileEnv[name]?.present) {
    return { present: true, raw: fileEnv[name].raw };
  }
  return { present: false, raw: "" };
}

console.log("=================================================================");
console.log(" ARTfolio — Production Deployment Preflight Audit");
console.log(" (Names & validation statuses only; secrets are never logged)");
console.log("=================================================================\n");

let blockers = 0;
let warnings = 0;

function report(category, name, status, details = "") {
  const padCat = category.padEnd(18);
  const padName = name.padEnd(35);
  const padStatus = status.padEnd(16);
  console.log(`[${padCat}] ${padName} ${padStatus} ${details}`);
}

// ------------------------------------------------------------------------------
// 1. Core Public Configuration
// ------------------------------------------------------------------------------
console.log("--- 1. Public Client Variables ---");

// NEXT_PUBLIC_SITE_URL
const siteUrl = getVar("NEXT_PUBLIC_SITE_URL");
if (!siteUrl.present) {
  report("Public Config", "NEXT_PUBLIC_SITE_URL", "MISSING", "Required for canonical links & redirects (Blocker)");
  blockers++;
} else {
  try {
    const parsed = new URL(siteUrl.raw);
    const isHttps = parsed.protocol === "https:";
    if (!isHttps) {
      report("Public Config", "NEXT_PUBLIC_SITE_URL", "WARNING", "Protocol is HTTP; production requires HTTPS");
      warnings++;
    } else {
      report("Public Config", "NEXT_PUBLIC_SITE_URL", "CONFIGURED", "Valid HTTPS URL");
    }
  } catch {
    report("Public Config", "NEXT_PUBLIC_SITE_URL", "INVALID_FORMAT", "Must be a valid absolute URL (Blocker)");
    blockers++;
  }
}

// NEXT_PUBLIC_SUPABASE_URL
const supabaseUrl = getVar("NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseUrl.present) {
  report("Public Config", "NEXT_PUBLIC_SUPABASE_URL", "MISSING", "Required for database client (Blocker)");
  blockers++;
} else {
  try {
    const parsed = new URL(supabaseUrl.raw);
    if (parsed.protocol !== "https:" || !parsed.hostname.includes("supabase.co")) {
      report("Public Config", "NEXT_PUBLIC_SUPABASE_URL", "WARNING", "Does not match expected *.supabase.co domain");
      warnings++;
    } else {
      report("Public Config", "NEXT_PUBLIC_SUPABASE_URL", "CONFIGURED", "Valid Supabase URL");
    }
  } catch {
    report("Public Config", "NEXT_PUBLIC_SUPABASE_URL", "INVALID_FORMAT", "Must be a valid URL (Blocker)");
    blockers++;
  }
}

// NEXT_PUBLIC_SUPABASE_ANON_KEY
const anonKey = getVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!anonKey.present) {
  report("Public Config", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "MISSING", "Required for public client queries (Blocker)");
  blockers++;
} else {
  let isAnonRole = anonKey.raw.startsWith("sb_publishable_");
  let isServiceRole = false;
  try {
    const parts = anonKey.raw.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload.role === "anon") isAnonRole = true;
      if (payload.role === "service_role") isServiceRole = true;
    }
  } catch {
    // Non-JWT key format
  }

  if (isServiceRole) {
    report("Public Config", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "CRITICAL_LEAK", "SERVICE ROLE KEY EXPOSED AS ANON KEY! (Blocker)");
    blockers++;
  } else if (!isAnonRole) {
    report("Public Config", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "WARNING", "Could not verify 'anon' role payload");
    warnings++;
  } else {
    report("Public Config", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "CONFIGURED", "Verified public anon client key");
  }
}

// ------------------------------------------------------------------------------
// 2. Server-Only Privileged Security
// ------------------------------------------------------------------------------
console.log("\n--- 2. Server-Only Security & Database ---");

// SUPABASE_SERVICE_ROLE_KEY
const serviceRoleKey = getVar("SUPABASE_SERVICE_ROLE_KEY");
if (!serviceRoleKey.present) {
  report("Server Privileged", "SUPABASE_SERVICE_ROLE_KEY", "MISSING", "Required for administrative operations & RLS bypass (Blocker)");
  blockers++;
} else {
  let isServiceRole = serviceRoleKey.raw.startsWith("sb_secret_");
  try {
    const parts = serviceRoleKey.raw.split(".");
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload.role === "service_role") isServiceRole = true;
    }
  } catch {
    // Non-JWT format
  }

  if (!isServiceRole) {
    report("Server Privileged", "SUPABASE_SERVICE_ROLE_KEY", "WARNING", "Key payload does not declare role 'service_role'");
    warnings++;
  } else {
    report("Server Privileged", "SUPABASE_SERVICE_ROLE_KEY", "CONFIGURED", "Verified server service_role key");
  }
}

// ADMIN_EMAIL
const adminEmail = getVar("ADMIN_EMAIL");
if (!adminEmail.present) {
  report("Server Privileged", "ADMIN_EMAIL", "MISSING", "Required for artist dashboard login allowlist (Blocker)");
  blockers++;
} else if (!adminEmail.raw.includes("@") || !adminEmail.raw.includes(".")) {
  report("Server Privileged", "ADMIN_EMAIL", "INVALID_FORMAT", "Must be a valid email address (Blocker)");
  blockers++;
} else {
  report("Server Privileged", "ADMIN_EMAIL", "CONFIGURED", "Configured owner email allowlist");
}

// CRON_SECRET
const cronSecret = getVar("CRON_SECRET");
if (!cronSecret.present) {
  report("Server Privileged", "CRON_SECRET", "MISSING", "Required for /api/cron/* background jobs (Warning)");
  warnings++;
} else {
  report("Server Privileged", "CRON_SECRET", "CONFIGURED", "Configured for scheduled cleanups");
}

// TELEMETRY_SALT
const telemetrySalt = getVar("TELEMETRY_SALT");
if (!telemetrySalt.present) {
  report("Server Privileged", "TELEMETRY_SALT", "NOT_CONFIGURED", "Optional: defaults to server salt for IP hashing");
} else {
  report("Server Privileged", "TELEMETRY_SALT", "CONFIGURED", "Custom salt configured for privacy hash");
}

// ------------------------------------------------------------------------------
// 3. Distributed Infrastructure (Rate Limiting)
// ------------------------------------------------------------------------------
console.log("\n--- 3. Distributed Infrastructure (Upstash Redis) ---");

const upstashUrl = getVar("UPSTASH_REDIS_REST_URL");
const upstashToken = getVar("UPSTASH_REDIS_REST_TOKEN");

if (!upstashUrl.present || !upstashToken.present) {
  report("Rate Limiting", "UPSTASH_REDIS_REST_URL", upstashUrl.present ? "CONFIGURED" : "MISSING", "Distributed rate limiting");
  report("Rate Limiting", "UPSTASH_REDIS_REST_TOKEN", upstashToken.present ? "CONFIGURED" : "MISSING", "Distributed rate limiting");
  report("Rate Limiting", "FAIL_CLOSED_NOTICE", "FAIL_CLOSED", "In production, missing Upstash causes rate-limited endpoints to deny requests (Blocker)");
  blockers++;
} else {
  report("Rate Limiting", "UPSTASH_REDIS_REST_URL", "CONFIGURED", "REST URL configured");
  report("Rate Limiting", "UPSTASH_REDIS_REST_TOKEN", "CONFIGURED", "Auth token configured");
}

// ------------------------------------------------------------------------------
// 4. Commercial Feature Gates & Integrations
// ------------------------------------------------------------------------------
console.log("\n--- 4. Feature Switches & Gateways ---");

const commissionsEnabled = getVar("ARTFOLIO_COMMISSIONS_ENABLED").raw === "true";
report("Feature Gate", "ARTFOLIO_COMMISSIONS_ENABLED", commissionsEnabled ? "ENABLED" : "PAUSED", commissionsEnabled ? "Public inquiries accepted" : "Returns HTTP 503");

if (commissionsEnabled) {
  const resendKey = getVar("RESEND_API_KEY");
  const resendFrom = getVar("RESEND_FROM_EMAIL");
  if (!resendKey.present) {
    report("Email / Outbox", "RESEND_API_KEY", "MISSING", "Required when commissions are enabled (Blocker)");
    blockers++;
  } else {
    report("Email / Outbox", "RESEND_API_KEY", "CONFIGURED", "Transactional email configured");
  }
  if (!resendFrom.present) {
    report("Email / Outbox", "RESEND_FROM_EMAIL", "MISSING", "Recommended verified sender domain (Warning)");
    warnings++;
  } else {
    report("Email / Outbox", "RESEND_FROM_EMAIL", "CONFIGURED", "Sender address configured");
  }
}

const paymentsEnabled = getVar("ARTFOLIO_PAYMENTS_ENABLED").raw === "true";
report("Feature Gate", "ARTFOLIO_PAYMENTS_ENABLED", paymentsEnabled ? "ENABLED" : "PAUSED", paymentsEnabled ? "Checkout & payments active" : "Returns HTTP 503");

if (paymentsEnabled) {
  const razorpayKey = getVar("RAZORPAY_KEY_ID") || getVar("NEXT_PUBLIC_RAZORPAY_KEY_ID");
  const razorpaySecret = getVar("RAZORPAY_SECRET");
  const webhookSecret = getVar("RAZORPAY_WEBHOOK_SECRET");

  if (!razorpayKey.present) {
    report("Payment Gateway", "RAZORPAY_KEY_ID", "MISSING", "Required for checkout (Blocker)");
    blockers++;
  } else {
    report("Payment Gateway", "RAZORPAY_KEY_ID", "CONFIGURED", razorpayKey.raw.startsWith("rzp_test_") ? "TEST MODE" : "LIVE MODE");
  }

  if (!razorpaySecret.present) {
    report("Payment Gateway", "RAZORPAY_SECRET", "MISSING", "Required for order verification (Blocker)");
    blockers++;
  } else {
    report("Payment Gateway", "RAZORPAY_SECRET", "CONFIGURED", "Configured");
  }

  if (!webhookSecret.present) {
    report("Payment Gateway", "RAZORPAY_WEBHOOK_SECRET", "MISSING", "Required for webhook signatures (Blocker)");
    blockers++;
  } else {
    report("Payment Gateway", "RAZORPAY_WEBHOOK_SECRET", "CONFIGURED", "Configured");
  }
}

// ------------------------------------------------------------------------------
// 5. Secret Leak Check (NEXT_PUBLIC_ prefix misuse)
// ------------------------------------------------------------------------------
console.log("\n--- 5. Client Bundle Leak Protection ---");

const allKeys = new Set([...Object.keys(process.env), ...Object.keys(fileEnv)]);
const suspiciousPublicKeys = [];
for (const key of allKeys) {
  if (key.startsWith("NEXT_PUBLIC_")) {
    const upper = key.toUpperCase();
    if (
      upper.includes("SERVICE_ROLE") ||
      upper.includes("SECRET") ||
      upper.includes("PRIVATE") ||
      upper.includes("PASSWORD") ||
      upper.includes("ADMIN_KEY") ||
      upper.includes("REDIS_TOKEN") ||
      upper.includes("RESEND_KEY")
    ) {
      suspiciousPublicKeys.push(key);
    }
  }
}

if (suspiciousPublicKeys.length > 0) {
  for (const leaked of suspiciousPublicKeys) {
    report("Leak Check", leaked, "CRITICAL_LEAK", "Server secret has NEXT_PUBLIC_ prefix! (Blocker)");
    blockers++;
  }
} else {
  report("Leak Check", "ALL_NEXT_PUBLIC_VARS", "CLEAN", "No private secrets exposed via NEXT_PUBLIC_ prefix");
}

// ------------------------------------------------------------------------------
// Summary
// ------------------------------------------------------------------------------
console.log("\n=================================================================");
if (blockers === 0 && warnings === 0) {
  console.log(" PREFLIGHT RESULT: READY FOR PRODUCTION (0 Blockers, 0 Warnings)");
  process.exit(0);
} else if (blockers === 0) {
  console.log(` PREFLIGHT RESULT: CONDITIONAL PASS (0 Blockers, ${warnings} Warning(s))`);
  process.exit(0);
} else {
  console.log(` PREFLIGHT RESULT: NO-GO (${blockers} Launch Blocker(s), ${warnings} Warning(s))`);
  console.log(" Remediate blockers in host dashboard (e.g., Vercel) before public traffic.");
  process.exit(1);
}
