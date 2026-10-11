import { redirect } from "next/navigation";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { formatRupees } from "@/shared/utils/money";

type Metrics = {
  inquiries: number; pending: number; approved: number; paid: number; in_progress: number;
  completed: number; rejected: number; cancelled: number; quoted: number; accepted: number;
  quote_acceptance_rate: number | null; inquiry_to_payment_rate: number | null;
  captured_revenue_paise: number; refund_total_paise: number; net_revenue_paise: number;
  average_order_value_paise: number | null;
  daily_revenue: { period: string; amount_paise: number }[];
  popular_artwork: { artwork_id: string; views: number }[];
};

export default async function AnalyticsPage() {
  if (!(await verifyAdminAuth()).authorized) redirect("/admin/login");
  const { data, error } = await getSupabaseAdmin().rpc("commission_business_metrics");
  const metrics = data as Metrics | null;
  return <div className="space-y-8"><header><p className="text-primary text-xs uppercase tracking-widest">Owner portal</p>
    <h1 className="font-serif text-3xl mt-2">Business analytics</h1>
    <p className="text-muted text-sm mt-2">All-time commission funnel and recorded payments. Daily revenue covers the last 30 days.</p></header>
    {error || !metrics ? <p role="alert" className="text-red-300">Metrics unavailable. Apply and verify the workflow migration before relying on analytics.</p> : <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{([
        ["Inquiries", metrics.inquiries], ["Pending", metrics.pending], ["Approved", metrics.approved],
        ["Paid", metrics.paid], ["In progress", metrics.in_progress], ["Completed", metrics.completed],
        ["Rejected", metrics.rejected], ["Cancelled", metrics.cancelled],
      ] as [string, number][]).map(([label, value]) =>
        <div key={label} className="border border-white/15 p-4"><p className="text-muted text-xs uppercase tracking-wider">{label}</p>
          <p className="font-serif text-3xl mt-2">{value}</p></div>)}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">{([
        ["Captured revenue", formatRupees(metrics.captured_revenue_paise)],
        ["Confirmed refunds", formatRupees(metrics.refund_total_paise)],
        ["Net revenue", formatRupees(metrics.net_revenue_paise)],
        ["Average captured payment", metrics.average_order_value_paise === null ? "—" : formatRupees(metrics.average_order_value_paise)],
      ] as [string, string][]).map(([label, value]) =>
        <div key={label} className="border border-white/15 p-4"><p className="text-muted text-xs uppercase tracking-wider">{label}</p>
          <p className="font-serif text-xl mt-2">{value}</p></div>)}</div>
      <section className="border border-white/15 p-5 space-y-2"><h2 className="font-serif text-xl">Conversion</h2>
        <p>Quote acceptance: {metrics.quote_acceptance_rate === null ? "No quotes yet" : `${(metrics.quote_acceptance_rate * 100).toFixed(1)}%`} ({metrics.accepted}/{metrics.quoted} quoted requests)</p>
        <p>Inquiry to payment: {metrics.inquiry_to_payment_rate === null ? "No inquiries yet" : `${(metrics.inquiry_to_payment_rate * 100).toFixed(1)}%`} ({metrics.paid}/{metrics.inquiries} inquiries, all time)</p></section>
      <div className="grid md:grid-cols-2 gap-6"><section className="border border-white/15 p-5"><h2 className="font-serif text-xl mb-3">Daily captured revenue</h2>
        {metrics.daily_revenue.length ? <ul className="space-y-2">{metrics.daily_revenue.map((day) =>
          <li key={day.period} className="flex justify-between gap-4"><span>{day.period}</span><span>{formatRupees(day.amount_paise)}</span></li>)}</ul> : <p className="text-muted">No captured payments in the last 30 days.</p>}</section>
        <section className="border border-white/15 p-5"><h2 className="font-serif text-xl mb-3">Popular artworks</h2>
          {metrics.popular_artwork.length ? <ul className="space-y-2">{metrics.popular_artwork.map((artwork) =>
            <li key={artwork.artwork_id} className="flex justify-between gap-4"><span>{artwork.artwork_id}</span><span>{artwork.views} views</span></li>)}</ul> : <p className="text-muted">No view events yet.</p>}</section></div>
      <p className="text-muted text-xs">Revenue counts captured payment rows, including later refunded payments. Net revenue deducts processed refund records. Traffic source is not collected; artwork views are approximate event counts, not unique visitors. Verify gateway reconciliation before financial reporting.</p>
    </>}
  </div>;
}
