import crypto from "node:crypto";

export function makeTrackingToken(nonce: string): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Commission token secret unavailable");
  return crypto.createHmac("sha256", secret).update(`tracking:v1:${nonce}`).digest("base64url");
}
