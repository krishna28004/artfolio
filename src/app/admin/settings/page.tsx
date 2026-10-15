import { redirect } from "next/navigation";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { isCommissionReleaseEnabled } from "@/shared/utils/release-controls";
import { CommissionAvailability } from "./CommissionAvailability";

export default async function AdminSettingsPage() {
  if (!(await verifyAdminAuth()).authorized) redirect("/admin/login");
  const checks = [
    ["Owner login identity", Boolean(process.env.ADMIN_EMAIL)],
    ["Supabase service role", Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)],
    ["Razorpay gateway", Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET)],
    ["Resend email", Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL)],
    ["Canonical site URL", Boolean(process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://"))],
    ["Scheduled job secret", Boolean(process.env.CRON_SECRET)],
    ["Distributed rate limit", Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)],
  ] as const;
  return <div className="space-y-8 max-w-3xl"><header><p className="text-primary text-xs uppercase tracking-widest">Owner portal</p>
    <h1 className="font-serif text-3xl mt-2">Operational settings</h1></header>
    <p className="text-muted text-sm">Configuration presence only. Secret values and customer tokens are never shown here. Database migration state and live service health require separate verification.</p>
    <ul className="border border-white/15 divide-y divide-white/10">{checks.map(([label, configured]) =>
      <li key={label} className="p-4 flex justify-between gap-4"><span>{label}</span>
        <span className={configured ? "text-emerald-400" : "text-amber-300"}>{configured ? "Configured" : "Missing"}</span></li>)}</ul>
    <CommissionAvailability releaseEnabled={isCommissionReleaseEnabled()} />
    <section className="border border-white/15 p-5 space-y-2"><h2 className="font-serif text-xl">Policy review before launch</h2>
      <p className="text-muted text-sm">The owner must approve commission scope, revision allowance, cancellation stages, refund eligibility, usage rights, privacy retention, and delivery terms. Enter the applicable terms on each quote before sending it.</p>
    </section>
  </div>;
}
