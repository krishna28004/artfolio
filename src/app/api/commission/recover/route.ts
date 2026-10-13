import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";
import { makeTrackingToken } from "@/features/commission/server/tracking-token";
import { deliverPendingNotifications } from "@/features/commission/server/notifications";

const recoverSchema = z.object({
  email: z.string().trim().email("Please provide a valid email address.").max(255),
});

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = recoverSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase().trim();
    const clientIp = getClientIp(req);

    // 1. IP Rate Limiting (5 attempts per 15 minutes)
    const ipLimit = await checkDistributedRateLimit(`recovery_ip_${clientIp}`, 5, 15 * 60 * 1000);
    if (!ipLimit.success) {
      return NextResponse.json(
        { success: false, message: "Too many recovery attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    // 2. Email Rate Limiting (3 attempts per 15 minutes, keying by hash to prevent plaintext email in cache)
    const emailHash = sha256(`email_recover_${email}`);
    const emailLimit = await checkDistributedRateLimit(`recovery_email_${emailHash}`, 3, 15 * 60 * 1000);
    if (!emailLimit.success) {
      return NextResponse.json(
        { success: false, message: "Too many recovery attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": "900" } }
      );
    }

    // 3. Authoritative lookup of commissions for this email
    const admin = getSupabaseAdmin();
    const { data: commissions, error: lookupError } = await admin
      .from("commissions")
      .select("id, name, email, request_reference, tracking_nonce, tracking_token_hash, status, created_at")
      .eq("email", email)
      .not("status", "in", '("rejected","cancelled")')
      .order("created_at", { ascending: false })
      .limit(3);

    if (lookupError) {
      console.error("[COMMISSION_RECOVERY_DB_ERROR]", lookupError.code || lookupError.message);
    } else if (commissions && commissions.length > 0) {
      // Process recovery for each matching active commission
      for (const commission of commissions) {
        // Ensure commission has a valid tracking nonce
        let nonce = commission.tracking_nonce;
        if (!nonce) {
          nonce = crypto.randomBytes(32).toString("base64url");
          const rawToken = makeTrackingToken(nonce);
          const tokenHash = sha256(rawToken);

          await admin
            .from("commissions")
            .update({
              tracking_nonce: nonce,
              tracking_token_hash: tokenHash,
              tracking_token_rotated_at: new Date().toISOString(),
            })
            .eq("id", commission.id);
        }

        // Deduplication window: at most 1 recovery notification per commission per hour
        const hourWindow = new Date().toISOString().slice(0, 13);
        const dedupeKey = `recovery:${commission.id}:${hourWindow}`;

        // Create recovery event in commission timeline
        const { data: event, error: eventError } = await admin
          .from("commission_events")
          .insert({
            commission_id: commission.id,
            actor_type: "system",
            event_type: "recovery_requested",
            body: "A private tracking link was requested via Find My Commission.",
            metadata: { dedupe: dedupeKey },
          })
          .select("id")
          .maybeSingle();

        if (event && !eventError) {
          // Queue notification job in outbox
          await admin
            .from("notification_jobs")
            .insert({
              commission_id: commission.id,
              dedupe_key: dedupeKey,
              recipient: commission.email,
              template: `${event.id}:customer`,
            });
        }
      }

      // Attempt immediate notification delivery if Resend is configured
      if (process.env.RESEND_API_KEY) {
        await deliverPendingNotifications(1).catch((cause) => {
          console.error("[RECOVERY_DELIVERY_ERROR]", cause);
        });
      }
    }

    // 4. Uniform Generic Anti-Enumeration Response:
    // Always return HTTP 200 with identical copy whether the account exists or not.
    return NextResponse.json(
      {
        success: true,
        message: "If an active commission inquiry is associated with this email address, you will receive tracking instructions shortly.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  } catch (error) {
    console.error("[COMMISSION_RECOVERY_FATAL]", error);
    // Even in case of unexpected internal errors, return generic response to prevent leak
    return NextResponse.json(
      {
        success: true,
        message: "If an active commission inquiry is associated with this email address, you will receive tracking instructions shortly.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      }
    );
  }
}
