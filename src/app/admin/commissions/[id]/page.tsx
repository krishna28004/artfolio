"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatRupees } from "@/shared/utils/money";

interface PaymentRecord {
  id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  amount: number;
  status: string;
  created_at: string;
}

interface CommissionDetail {
  id: string;
  name: string;
  email: string;
  status: string;
  size: string;
  budget: string;
  deadline: string | null;
  message: string;
  image_url: string | null;
  price: number | null;
  admin_notes: string | null;
  expires_at: string | null;
  created_at: string;
  payments?: PaymentRecord[];
}

export default function AdminCommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const resolvedParams = use(Promise.resolve(params));
  const commissionId = resolvedParams.id;

  const [commission, setCommission] = useState<CommissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [quoteRupees, setQuoteRupees] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    async function loadCommission() {
      try {
        const res = await fetch(`/api/admin/commissions/${commissionId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setCommission(data.data);
            if (data.data.price) {
              setQuoteRupees(String(Math.round(data.data.price / 100)));
            }
            if (data.data.admin_notes) {
              setAdminNotes(data.data.admin_notes);
            }
          }
        }
      } catch (err) {
        console.warn("[ADMIN_COMMISSION_DETAIL_LOAD_ERROR]", err);
      } finally {
        setLoading(false);
      }
    }

    loadCommission();
  }, [commissionId]);

  const handleApprove = async () => {
    const rupees = parseInt(quoteRupees, 10);
    if (isNaN(rupees) || rupees <= 0) {
      setActionFeedback({ type: "error", message: "Please provide a valid positive honorarium quote in Rupees." });
      return;
    }

    setActionLoading(true);
    setActionFeedback(null);

    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionId,
          priceInRupees: rupees,
          adminNotes: adminNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionFeedback({ type: "error", message: data.message || "Approval failed." });
      } else {
        setActionFeedback({
          type: "success",
          message: `Approved! 24h checkout token generated. Customer notified via email.`,
        });
        // Reload record
        const updatedRes = await fetch(`/api/admin/commissions/${commissionId}`);
        const updated = await updatedRes.json();
        if (updated.success) setCommission(updated.data);
      }
    } catch {
      setActionFeedback({ type: "error", message: "Network error during approval." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reasonPrompt = prompt("Optional studio reason for declining this inquiry:");
    if (reasonPrompt === null) return; // User cancelled prompt

    setActionLoading(true);
    setActionFeedback(null);

    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commissionId,
          reason: reasonPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionFeedback({ type: "error", message: data.message || "Rejection failed." });
      } else {
        setActionFeedback({ type: "success", message: "Commission declined. Status updated to rejected." });
        const updatedRes = await fetch(`/api/admin/commissions/${commissionId}`);
        const updated = await updatedRes.json();
        if (updated.success) setCommission(updated.data);
      }
    } catch {
      setActionFeedback({ type: "error", message: "Network error during rejection." });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-32 text-center text-muted font-sans text-xs tracking-widest uppercase">
        Retrieving Commission Archive...
      </div>
    );
  }

  if (!commission) {
    return (
      <div className="py-32 text-center space-y-4">
        <p className="font-serif text-2xl text-text">Commission Not Found</p>
        <Link href="/admin/commissions" className="text-xs uppercase tracking-widest text-primary">
          &larr; Return to Commissions Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* Back button & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-outline-variant/20">
        <div>
          <Link
            href="/admin/commissions"
            className="text-[11px] uppercase tracking-widest text-muted hover:text-text transition-colors inline-block mb-3"
          >
            &larr; Commissions Queue
          </Link>
          <h1 className="font-serif text-3xl md:text-4xl text-text font-normal">
            Bespoke Inquiry: {commission.name}
          </h1>
          <p className="font-sans text-muted text-xs mt-1">
            Submitted on {new Date(commission.created_at).toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-sans text-xs uppercase tracking-widest text-muted">Status:</span>
          <span className="px-3 py-1 border border-primary/40 bg-primary/10 text-primary font-mono text-xs uppercase tracking-widest">
            {commission.status}
          </span>
        </div>
      </div>

      {actionFeedback && (
        <div
          role="alert"
          className={`p-4 border font-sans text-xs tracking-wide ${
            actionFeedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
              : "border-red-500/40 bg-red-950/20 text-red-300"
          }`}
        >
          {actionFeedback.message}
        </div>
      )}

      {/* Main Grid: Details & Reference Photo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left: Requirements & Specifications (7 Cols) */}
        <div className="lg:col-span-7 space-y-8">
          <section className="bg-surface-highest/5 border border-outline-variant/20 p-6 md:p-8 space-y-6">
            <h2 className="font-serif text-xl text-text font-normal border-b border-outline-variant/10 pb-4">
              Collector Specifications
            </h2>

            <div className="grid grid-cols-2 gap-6 font-sans text-xs">
              <div>
                <p className="text-muted uppercase tracking-widest text-[10px]">Collector Name</p>
                <p className="text-text font-medium text-sm mt-1">{commission.name}</p>
              </div>
              <div>
                <p className="text-muted uppercase tracking-widest text-[10px]">Contact Email</p>
                <p className="text-text font-mono text-sm mt-1">{commission.email}</p>
              </div>
              <div>
                <p className="text-muted uppercase tracking-widest text-[10px]">Paper Dimension</p>
                <p className="text-text font-medium text-sm mt-1 uppercase">{commission.size}</p>
              </div>
              <div>
                <p className="text-muted uppercase tracking-widest text-[10px]">Stated Budget</p>
                <p className="text-text font-medium text-sm mt-1">{commission.budget}</p>
              </div>
              {commission.deadline && (
                <div className="col-span-2">
                  <p className="text-muted uppercase tracking-widest text-[10px]">Desired Target Date</p>
                  <p className="text-text text-sm mt-1">{commission.deadline}</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-outline-variant/10">
              <p className="text-muted uppercase tracking-widest text-[10px] mb-2">Artistic Vision & Message</p>
              <div className="p-4 bg-surface-lowest/40 border border-outline-variant/20 text-text font-sans text-xs leading-relaxed whitespace-pre-wrap">
                {commission.message}
              </div>
            </div>
          </section>

          {/* Review & Action Panel */}
          {commission.status === "pending" && (
            <section className="bg-surface-highest/5 border border-primary/30 p-6 md:p-8 space-y-6">
              <h2 className="font-serif text-xl text-primary font-normal">
                Curatorial Honorarium Quote
              </h2>
              <p className="font-sans text-muted text-xs">
                Setting a price moves this inquiry into <span className="text-text font-semibold">approved</span> status,
                creates a secure 24-hour token-gated link, and sends an official notification email to the collector.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="quoteRupees" className="block text-muted uppercase tracking-widest text-[11px] mb-2">
                    Studio Quote (INR ₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-muted font-mono text-sm">₹</span>
                    <input
                      id="quoteRupees"
                      type="number"
                      min="1"
                      step="1"
                      value={quoteRupees}
                      onChange={(e) => setQuoteRupees(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full bg-surface-lowest/60 border border-outline-variant/30 text-text pl-10 pr-4 py-3 text-base font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="adminNotes" className="block text-muted uppercase tracking-widest text-[11px] mb-2">
                    Curatorial Notes (Optional)
                  </label>
                  <textarea
                    id="adminNotes"
                    rows={2}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Internal reference notes..."
                    className="w-full bg-surface-lowest/60 border border-outline-variant/30 text-text px-4 py-2.5 text-xs font-sans focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-outline-variant/20">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 py-3.5 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.2em] hover:bg-white transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Approve & Generate Checkout &rarr;"}
                  </button>

                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="px-6 py-3.5 border border-red-500/30 text-red-400 font-sans uppercase text-[11px] tracking-widest hover:bg-red-950/20 transition-all disabled:opacity-50"
                  >
                    Decline Inquiry
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Status Details for Approved or Paid */}
          {commission.status !== "pending" && (
            <section className="bg-surface-highest/5 border border-outline-variant/20 p-6 md:p-8 space-y-4">
              <h2 className="font-serif text-lg text-text font-normal">Acquisition Financials</h2>
              <div className="grid grid-cols-2 gap-4 font-sans text-xs">
                <div>
                  <p className="text-muted uppercase tracking-widest text-[10px]">Authoritative Quote</p>
                  <p className="text-primary font-mono text-base font-semibold mt-1">
                    {commission.price ? formatRupees(commission.price) : "Not quoted"}
                  </p>
                </div>
                <div>
                  <p className="text-muted uppercase tracking-widest text-[10px]">Expiration Window</p>
                  <p className="text-text mt-1 font-mono text-xs">
                    {commission.expires_at ? new Date(commission.expires_at).toLocaleString() : "N/A"}
                  </p>
                </div>
              </div>

              {/* Payments History if any */}
              {commission.payments && commission.payments.length > 0 && (
                <div className="pt-4 border-t border-outline-variant/10">
                  <p className="text-muted uppercase tracking-widest text-[10px] mb-3">Gateway Payment Records</p>
                  <div className="space-y-2">
                    {commission.payments.map((p) => (
                      <div key={p.id} className="p-3 bg-surface-lowest/50 border border-outline-variant/20 text-xs font-mono flex justify-between items-center">
                        <div>
                          <span className="text-text font-semibold">{formatRupees(p.amount)}</span>
                          <span className="text-muted ml-2">Order: {p.razorpay_order_id}</span>
                        </div>
                        <span className="text-emerald-400 uppercase text-[10px] tracking-wider">{p.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Right: Reference Photograph (5 Cols) */}
        <div className="lg:col-span-5">
          <div className="bg-surface-highest/5 border border-outline-variant/20 p-6 sticky top-24 space-y-4">
            <h3 className="font-serif text-lg text-text font-normal">Reference Subject</h3>
            {commission.image_url ? (
              <div className="space-y-4">
                <div className="relative aspect-[3/4] bg-surface-lowest border border-outline-variant/30 overflow-hidden flex items-center justify-center">
                  <Image
                    src={commission.image_url}
                    alt={`Reference for ${commission.name}`}
                    fill
                    unoptimized
                    className="object-contain"
                  />
                </div>
                <a
                  href={commission.image_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center py-2 border border-outline-variant/30 text-muted hover:text-text uppercase text-[10px] tracking-widest transition-colors"
                >
                  View Full Resolution In New Window &nearr;
                </a>
              </div>
            ) : (
              <div className="aspect-[3/4] bg-surface-lowest/40 border border-dashed border-outline-variant/30 flex items-center justify-center p-6 text-center text-muted font-sans text-xs">
                No reference photograph provided.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
