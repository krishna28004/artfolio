import "server-only";
import crypto from "node:crypto";

export function acceptedQuoteCheckoutToken(commissionId: string, version: number): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Checkout token secret unavailable");
  return crypto.createHmac("sha256", secret)
    .update(`accepted-quote:v1:${commissionId}:${version}`).digest("base64url");
}
