import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { timingSafeEqualStr } from "@/shared/utils/crypto";

export const accessCookieName = (id: string) => `commission_access_${id}`;
export const hashAccessToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function authorizeCustomer(req: NextRequest, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)) return null;
  const candidate = req.cookies.get(accessCookieName(id))?.value;
  if (!candidate || !/^[0-9a-f]{64}$/.test(candidate)) return null;
  const { data, error } = await getSupabaseAdmin().from("commissions")
    .select("id, tracking_token_hash, checkout_token_hash, expires_at, status, request_reference, name, size, budget, deadline, message, price, currency, quote_version, accepted_quote_version, quote_scope, quote_terms, estimated_delivery_at, revision_allowance, created_at, updated_at")
    .eq("id", id).maybeSingle();
  if (error || !data?.tracking_token_hash || !timingSafeEqualStr(candidate, data.tracking_token_hash)) return null;
  return data;
}
