import { logSecurityFailure } from "@/shared/utils/security-log";
import "server-only";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { makeTrackingToken } from "@/features/commission/server/tracking-token";

export function notificationRecipientAllowed(audience: string, recipient: string, customerEmail: string | null | undefined) {
  const owner = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  const expected = audience === "customer" ? customerEmail : audience === "owner" ? owner : null;
  return !!expected && /^[^\s,;<>@]+@[^\s,;<>@]+\.[^\s,;<>@]+$/.test(recipient) &&
    recipient.length <= 254 && recipient.toLowerCase() === expected.toLowerCase();
}

export async function queueCommissionNotice(commissionId: string, eventId: string, recipient: string, audience: "customer" | "owner") {
  const { data: commission, error: lookupError } = await getSupabaseAdmin().from("commissions")
    .select("email").eq("id", commissionId).maybeSingle();
  if (lookupError || !notificationRecipientAllowed(audience, recipient, commission?.email)) return false;
  const { error } = await getSupabaseAdmin().from("notification_jobs").upsert({
    commission_id: commissionId, dedupe_key: `${eventId}:${audience}`, recipient,
    template: `${eventId}:${audience}`,
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) logSecurityFailure("[NOTIFICATION_QUEUE_ERROR]");
  return !error;
}

export async function deliverPendingNotifications(limit = 10) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) return { sent: 0, pending: "Resend is not configured" };
  const admin = getSupabaseAdmin();
  // A worker can terminate after claiming a job. Return expired claims to the
  // queue; Resend's stable idempotency key protects a retry after send/ack loss.
  const { error: recoveryError } = await admin.from("notification_jobs")
    .update({ state: "failed" }).eq("state", "sending")
    .lte("next_attempt_at", new Date().toISOString());
  if (recoveryError) throw recoveryError;
  const { data: jobs, error } = await admin.from("notification_jobs")
    .select("id, commission_id, dedupe_key, recipient, template, attempts")
    .in("state", ["pending", "failed"]).lte("next_attempt_at", new Date().toISOString())
    .order("created_at", { ascending: true }).limit(limit);
  if (error) throw error;
  const resend = new Resend(process.env.RESEND_API_KEY);
  const site = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:3000");
  const siteUrl = new URL(site);
  if (siteUrl.username || siteUrl.password || siteUrl.search || siteUrl.hash) throw new Error("Invalid canonical site URL");
  if (siteUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && siteUrl.hostname === "localhost")) {
    throw new Error("Canonical HTTPS site URL is required for notifications");
  }
  let sent = 0;
  for (const job of jobs || []) {
    const { data: locked } = await admin.from("notification_jobs")
      .update({ state: "sending", attempts: job.attempts + 1,
        next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() })
      .eq("id", job.id).in("state", ["pending", "failed"])
      .select("id").maybeSingle();
    if (!locked) continue;
    try {
      const [eventId, audience] = job.template.split(":");
      const [{ data: event }, { data: commission }] = await Promise.all([
        admin.from("commission_events").select("event_type, body, metadata")
          .eq("id", eventId).eq("commission_id", job.commission_id).maybeSingle(),
        admin.from("commissions").select("id, name, email, request_reference, tracking_nonce, status")
          .eq("id", job.commission_id).maybeSingle(),
      ]);
      if (!event || !commission || !/^[0-9a-f-]{36}:(customer|owner)$/i.test(job.template) ||
          job.dedupe_key !== job.template || !notificationRecipientAllowed(audience, job.recipient, commission.email)) {
        throw new Error("Notification identity or recipient invalid");
      }
      const trackingLink = commission.tracking_nonce ? new URL(
        `/commission/track/open?id=${commission.id}&token=${encodeURIComponent(makeTrackingToken(commission.tracking_nonce))}`,
        siteUrl).toString() : null;
      const ownerLink = new URL(`/admin/commissions/${commission.id}`, siteUrl).toString();
      const link = audience === "owner" ? ownerLink : trackingLink;
      const subject = `Artfolio ${commission.request_reference || "commission"}: ${event.event_type.replaceAll("_", " ")}`;
      const text = `${audience === "owner" ? "A commission update needs your review." : `Hello ${commission.name}, your commission has an update.`}\n\n` +
        `Update: ${event.event_type.replaceAll("_", " ")}\n` +
        (event.body ? `Message: ${event.body}\n` : "") +
        `Current status: ${commission.status}\nReference: ${commission.request_reference || commission.id}\n` +
        (link ? `Open securely: ${link}\n` : "");
      const response = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "notifications@artfolio.com",
        to: job.recipient, subject, text,
      }, { idempotencyKey: job.dedupe_key });
      if (response.error) throw response.error;
      const { error: updateError } = await admin.from("notification_jobs")
        .update({ state: "sent", sent_at: new Date().toISOString(), last_error: null })
        .eq("id", job.id);
      if (updateError) throw updateError;
      sent++;
    } catch {
      logSecurityFailure("[NOTIFICATION_DELIVERY_ERROR]");
      await admin.from("notification_jobs").update({
        state: "failed", last_error: "Delivery failed; retry scheduled",
        next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** Math.min(job.attempts, 6)) * 60 * 1000).toISOString(),
      }).eq("id", job.id);
    }
  }
  return { sent, pending: Math.max(0, (jobs || []).length - sent) };
}
