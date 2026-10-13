import { isCommissionIntakeEnabled } from "@/shared/utils/release-controls";
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { commissionSchema } from "@/features/commission/schema/commission-schema";
import { supabaseAdmin } from "@/shared/services/supabase-admin";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";
import { makeTrackingToken } from "@/features/commission/server/tracking-token";
import { deliverPendingNotifications } from "@/features/commission/server/notifications";

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function attachReferences(id: string, claims: { id: string; token: string }[]) {
  if (!claims.length) return true;
  const { error } = await supabaseAdmin.rpc("attach_commission_references", {
    p_commission_id: id,
    p_claims: claims.map((claim) => ({ id: claim.id, hash: sha256(claim.token) })),
  });
  if (error) console.error("[REFERENCE_ATTACH_ERROR]", error);
  return !error;
}

export async function POST(req: Request) {
  if (!isCommissionIntakeEnabled()) return NextResponse.json({ success: false, message: "New commissions are temporarily paused. Please check back later." }, {
    status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "3600" },
  });
  try {
    const limit = await checkDistributedRateLimit(`commission_${getClientIp(req)}`, 5, 15 * 60 * 1000);
    if (!limit.success) {
      return NextResponse.json({ success: false, message: "Too many inquiries. Please try again later." }, { status: 429 });
    }
    const parsed = commissionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Invalid request details.", errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const data = parsed.data;
    const claimIds = data.fileClaims.map((claim) => claim.id);
    if (new Set(claimIds).size !== claimIds.length) {
      return NextResponse.json({ success: false, message: "Duplicate reference file." }, { status: 400 });
    }
    const id = crypto.randomUUID();
    const reference = `AF-${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const token = makeTrackingToken(data.idempotencyKey);
    const tokenHash = sha256(token);
    const { error } = await supabaseAdmin.from("commissions").insert({
      id, idempotency_key: data.idempotencyKey, name: data.name, email: data.email,
      image_url: null, public_id: null, size: data.size, budget: data.budget,
      deadline: data.deadline || null, message: data.message, status: "pending",
      request_reference: reference, tracking_token_hash: tokenHash, reference_claim_ids: claimIds,
      tracking_nonce: data.idempotencyKey,
    });
    if (error) {
      if (error.code !== "23505") {
        console.error("[COMMISSION_INSERT_ERROR]", error);
        return NextResponse.json({ success: false, message: "Could not save your request." }, { status: 503 });
      }
      const { data: previous } = await supabaseAdmin.from("commissions")
        .select("id, name, email, size, budget, deadline, message, request_reference, tracking_token_hash, reference_claim_ids")
        .eq("idempotency_key", data.idempotencyKey).maybeSingle();
      if (!previous || previous.name !== data.name || previous.email !== data.email ||
          previous.size !== data.size || previous.budget !== data.budget ||
          previous.deadline !== (data.deadline || null) || previous.message !== data.message ||
          JSON.stringify(previous.reference_claim_ids || []) !== JSON.stringify(claimIds)) {
        return NextResponse.json({ success: false, message: "Request key was already used for different details." }, { status: 409 });
      }
      if (!(await attachReferences(previous.id, data.fileClaims))) {
        return NextResponse.json({ success: false, message: "Could not attach reference files. Please retry." }, { status: 503 });
      }
      const ownerEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || null;
      const { error: eventError } = await supabaseAdmin.rpc("ensure_commission_submission_events", {
        p_commission_id: previous.id, p_owner_recipient: ownerEmail,
      });
      if (eventError) return NextResponse.json({ success: false, message: "Request received, but confirmation could not be queued. Please retry." }, { status: 503 });
      if (process.env.RESEND_API_KEY) await deliverPendingNotifications(2).catch((cause) => console.error("[NOTIFICATION_DELIVERY_ERROR]", cause));
      return NextResponse.json({ success: true, id: previous.id, reference: previous.request_reference,
        trackingToken: previous.tracking_token_hash === tokenHash ? token : undefined,
        message: "Request previously received." });
    }
    if (!(await attachReferences(id, data.fileClaims))) {
      return NextResponse.json({ success: false, message: "Request saved, but references could not be attached. Please retry." }, { status: 503 });
    }
    const ownerEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL || null;
    const { error: eventError } = await supabaseAdmin.rpc("ensure_commission_submission_events", {
      p_commission_id: id, p_owner_recipient: ownerEmail,
    });
    if (eventError) {
      console.error("[COMMISSION_EVENT_ERROR]", eventError.message);
      return NextResponse.json({ success: false, message: "Request received, but confirmation could not be queued. Please retry." }, { status: 503 });
    }
    if (process.env.RESEND_API_KEY) await deliverPendingNotifications(2).catch((cause) => console.error("[NOTIFICATION_DELIVERY_ERROR]", cause));
    return NextResponse.json({ success: true, id, reference, trackingToken: token,
      message: "Commission inquiry received successfully." });
  } catch (error) {
    console.error("[COMMISSION_ROUTE_FATAL]", error);
    return NextResponse.json({ success: false, message: "Server encountered an unexpected error." }, { status: 500 });
  }
}
