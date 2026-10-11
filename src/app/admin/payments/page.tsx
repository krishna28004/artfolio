import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { formatRupees } from "@/shared/utils/money";
import { ReconcileButton } from "./ReconcileButton";

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  if (!(await verifyAdminAuth()).authorized) redirect("/admin/login");
  const page = Math.max(1, Math.min(10000, Number((await searchParams).page) || 1));
  const admin = getSupabaseAdmin();
  const [{ data: payments, error }, { data: pendingEvents }, { data: refunds }] = await Promise.all([
    admin.from("payments").select("id, commission_id, razorpay_order_id, razorpay_payment_id, amount, currency, status, created_at")
      .order("created_at", { ascending: false }).range((page - 1) * 25, page * 25),
    admin.from("payment_events").select("event_id, event_type, state, received_at, commission_id")
      .in("state", ["received", "failed"]).order("received_at", { ascending: false }).limit(30),
    admin.from("commission_refunds").select("id, commission_id, amount, status, reason, created_at")
      .order("created_at", { ascending: false }).limit(30),
  ]);
  return <div className="space-y-8"><header><p className="text-primary text-xs uppercase tracking-widest">Owner portal</p>
    <h1 className="font-serif text-3xl mt-2">Payments and refunds</h1>
    <p className="text-muted text-sm mt-2">Read-only gateway inspection and captured-payment reconciliation. This page never charges or refunds anyone.</p></header>
    {error && <p role="alert" className="text-red-300">Payment records are unavailable.</p>}
    <section className="space-y-3"><h2 className="font-serif text-xl">Payment records</h2>
      {payments?.length ? payments.slice(0, 25).map((payment) => <article key={payment.id} className="border border-white/15 p-4 space-y-2">
        <div className="flex flex-wrap justify-between gap-2"><Link href={`/admin/commissions/${payment.commission_id}`} className="text-primary underline">Commission {payment.commission_id.slice(0, 8)}</Link>
          <span>{formatRupees(payment.amount)} · {payment.status}</span></div>
        <p className="text-muted text-xs break-all">Order {payment.razorpay_order_id} · Payment {payment.razorpay_payment_id || "pending"}</p>
        <ReconcileButton commissionId={payment.commission_id} /></article>) : !error && <p className="text-muted">No payment records yet.</p>}
      <div className="flex gap-4 text-primary text-sm">{page > 1 && <Link href={`/admin/payments?page=${page - 1}`}>Previous</Link>}
        {payments?.length === 26 && <Link href={`/admin/payments?page=${page + 1}`}>Next</Link>}</div></section>
    <section className="space-y-3"><h2 className="font-serif text-xl">Webhook events awaiting review</h2>
      {pendingEvents?.length ? pendingEvents.map((event) => <p key={event.event_id} className="border border-amber-500/25 p-3 text-sm break-all">
        {event.event_type} · {event.state} · {new Date(event.received_at).toLocaleString()} {event.commission_id && <Link href={`/admin/commissions/${event.commission_id}`} className="text-primary">Open commission</Link>}</p>) : <p className="text-muted">No pending event records.</p>}</section>
    <section className="space-y-3"><h2 className="font-serif text-xl">Refund records</h2>
      {refunds?.length ? refunds.map((refund) => <p key={refund.id} className="border border-white/15 p-3 text-sm">
        <Link href={`/admin/commissions/${refund.commission_id}`} className="text-primary underline">Commission</Link> · {formatRupees(refund.amount)} · {refund.status}</p>) : <p className="text-muted">No refund records.</p>}</section>
  </div>;
}
