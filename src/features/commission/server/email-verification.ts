import "server-only";
import crypto from "node:crypto";

export const COMMISSION_VERIFICATION_COOKIE = "artfolio-commission-verified";
export const COMMISSION_VERIFICATION_SECONDS = 60 * 60;
export const COMMISSION_CHALLENGE_SECONDS = 10 * 60;

export function normalizedCommissionEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s,;<>@]+@[^\s,;<>@]+\.[^\s,;<>@]+$/.test(email) ? email : null;
}

function signingKey() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return crypto.createHmac("sha256", secret).update("artfolio/commission-email-verification/v2").digest();
}

export function commissionEmailDigest(email: string): string {
  return crypto.createHash("sha256").update(email).digest("hex");
}

export function commissionChallengeKey(challengeId: string): string {
  return `artfolio:commission:email-code:${challengeId}`;
}

export function commissionChallengeDigest(challengeId: string, email: string, code: string): string | null {
  const key = signingKey();
  if (!key) return null;
  return crypto.createHmac("sha256", key).update(`${challengeId}:${email}:${code}`).digest("hex");
}

export function challengeMatches(actual: string | null, expected: string | null): boolean {
  if (!actual || !expected || !/^[0-9a-f]{64}$/.test(actual)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function createCommissionVerification(email: string, now = Date.now()): string | null {
  const key = signingKey();
  const normalized = normalizedCommissionEmail(email);
  if (!key || !normalized) return null;
  const payload = `${Buffer.from(normalized).toString("base64url")}.${Math.floor(now / 1000) + COMMISSION_VERIFICATION_SECONDS}`;
  const signature = crypto.createHmac("sha256", key).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readCommissionVerification(marker: string | undefined, now = Date.now()): string | null {
  const key = signingKey();
  if (!key || !marker) return null;
  const parts = marker.split(".");
  if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[0])) return null;
  const expiry = Number(parts[1]);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(now / 1000)) return null;
  const payload = parts.slice(0, 2).join(".");
  const expected = crypto.createHmac("sha256", key).update(payload).digest();
  const received = Buffer.from(parts[2], "base64url");
  if (received.length !== expected.length || !crypto.timingSafeEqual(received, expected)) return null;
  const email = Buffer.from(parts[0], "base64url").toString("utf8");
  return normalizedCommissionEmail(email) === email ? email : null;
}
