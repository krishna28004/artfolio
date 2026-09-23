import crypto from "crypto";

/**
 * Compares two strings in constant time to prevent timing attacks.
 * Returns false if lengths do not match or if characters differ.
 * 
 * Safe against length mismatch RangeError thrown by crypto.timingSafeEqual.
 */
export function timingSafeEqualStr(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }

  // An empty signature is never valid in financial/webhook contexts
  if (a.length === 0 || b.length === 0) {
    return false;
  }

  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Computes a SHA-256 HMAC signature in hex format.
 */
export function computeHmacSha256(data: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("hex");
}
