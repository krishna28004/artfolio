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
  request_reference: string | null;
  quote_version: number;
  quote_scope: string | null;
  quote_terms: string | null;
  estimated_delivery_at: string | null;
  revision_allowance: number;
  files?: { id: string; kind: string; file_name: string; size_bytes: number }[];
  events?: { id: string; actor_type: string; event_type: string; body: string | null; created_at: string }[];
  refunds?: { id: string; amount: number; status: string; reason: string | null }[];
  payments?: PaymentRecord[];
}

export default function AdminCommissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(Promise.resolve(params));
  const commissionId = resolvedParams.id;

  const [commission, setCommission] = useState<CommissionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [quoteRupees, setQuoteRupees] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [manualCheckoutUrl, setManualCheckoutUrl] = useState("");
  const [quoteScope, setQuoteScope] = useState("");
  const [quoteTerms, setQuoteTerms] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [revisions, setRevisions] = useState("1");
  const [studioMessage, setStudioMessage] = useState("");
  const [deliverable, setDeliverable] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    async function loadCommission() {
      setLoading(true);
      setLoadError("");
      try {
        const res = await fetch(`/api/admin/commissions/${commissionId}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success || !data.data) {
          throw new Error(data?.message || (res.status === 401
            ? "Your studio session is no longer authorized. Sign in again and complete authenticator verification."
            : res.status === 404 ? "This commission request was not found."
              : "Commission details could not be loaded. Please try again."));
        }
        if (!active) return;
        setCommission(data.data);
        if (data.data.price) setQuoteRupees(String(Math.round(data.data.price / 100)));
        if (data.data.admin_notes) setAdminNotes(data.data.admin_notes);
        setQuoteScope(data.data.quote_scope || "");
        setQuoteTerms(data.data.quote_terms || "");
        setRevisions(String(data.data.revision_allowance ?? 1));
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "Commission details could not be loaded. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCommission();
    return () => { active = false; };
  }, [commissionId, reloadCount]);

  const handleApprove = async () => {
    if (!window.confirm("Send this quote and terms to the customer for acceptance?")) return;
    const rupees = parseInt(quoteRupees, 10);
    if (isNaN(rupees) || rupees <= 0) {
      setActionFeedback({ type: "error", message: "Please provide a valid positive honorarium quote in Rupees." });
      return;
    }

    setActionLoading(true);
    setActionFeedback(null);

    try {
      const res = await fetch("/api/admin/commission-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: commissionId,
          action: "send_quote",
          priceRupees: rupees,
          scope: quoteScope.trim(),
          terms: quoteTerms.trim(),
          estimatedDeliveryAt: deliveryDate ? new Date(`${deliveryDate}T12:00:00Z`).toISOString() : undefined,
          revisionAllowance: Number(revisions),
          adminNotes: adminNotes.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionFeedback({ type: "error", message: data.message || "Approval failed." });
      } else {
        setManualCheckoutUrl("");
        setActionFeedback({
          type: "success",
          message: "Quote saved. The customer must accept this version before checkout; email delivery is queued when configured.",
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
    const reasonPrompt = prompt("Reason for declining this inquiry (shared with the customer):");
    if (reasonPrompt === null) return; // User cancelled prompt

    setActionLoading(true);
    setActionFeedback(null);

    try {
      const res = await fetch("/api/admin/commission-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: commissionId,
          action: "reject",
          body: reasonPrompt.trim(),
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

  const refreshCommission = async () => {
    const response = await fetch(`/api/admin/commissions/${commissionId}`, { cache: "no-store" });
    const result = await response.json();
    if (response.ok && result.success) setCommission(result.data);
  };

  const runWorkflowAction = async (action: string) => {
    if (["deliver", "cancel", "rotate_token"].includes(action) &&
        !window.confirm(`Confirm ${action.replaceAll("_", " ")} for this commission?`)) return;
    setActionLoading(true); setActionFeedback(null);
    try {
      const response = await fetch("/api/admin/commission-action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: commissionId, action, body: studioMessage.trim() || undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Action failed.");
      setActionFeedback({ type: "success", message: result.trackingToken ?
        `Access token rotated. The customer will receive an updated tracking link when email delivery is configured.` :
        "Update saved and notification queued." });
      setStudioMessage(""); await refreshCommission();
    } catch (cause) {
      setActionFeedback({ type: "error", message: cause instanceof Error ? cause.message : "Action failed." });
    } finally { setActionLoading(false); }
  };

  const uploadFinal = async () => {
    if (!deliverable) return;
    setActionLoading(true); setActionFeedback(null);
    try {
      const form = new FormData(); form.append("commissionId", commissionId); form.append("file", deliverable);
      const response = await fetch("/api/admin/commission-deliverable", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Upload failed.");
      setDeliverable(null); setActionFeedback({ type: "success", message: "Private deliverable uploaded. Mark delivery when ready." });
      await refreshCommission();
    } catch (cause) { setActionFeedback({ type: "error", message: cause instanceof Error ? cause.message : "Upload failed." }); }
    finally { setActionLoading(false); }
  };

  if (loading) {
    return (
      <div className="py-32 text-center text-muted font-sans text-xs tracking-widest uppercase">
        Retrieving Commission Archive...
      </div>
    );
  }

  if (loadError || !commission) {
    return (
      <div className="py-32 text-center space-y-4" role={loadError ? "alert" : undefined}>
        <p className="font-serif text-2xl text-text">{loadError || "Commission Not Found"}</p>
        {loadError && <button type="button" onClick={() => setReloadCount((count) => count + 1)}
          className="border border-outline-variant/30 px-4 py-2 text-[10px] uppercase tracking-widest text-text hover:border-primary hover:text-primary">
          Retry loading request
        </button>}
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
      {manualCheckoutUrl && (
        <div className="space-y-2">
          <label htmlFor="manual-checkout-link" className="text-xs text-amber-300">Private checkout link (shown only now)</label>
          <input id="manual-checkout-link" readOnly value={manualCheckoutUrl} onFocus={(event) => event.currentTarget.select()}
            className="w-full p-3 bg-surface-lowest text-text border border-amber-500/40 text-xs font-mono" />
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
          {["pending", "under_review", "clarification_requested", "quote_sent"].includes(commission.status) && (
            <section className="bg-surface-highest/5 border border-primary/30 p-6 md:p-8 space-y-6">
              <h2 className="font-serif text-xl text-primary font-normal">
                Curatorial Honorarium Quote
              </h2>
              <p className="font-sans text-muted text-xs">
                Set the complete scope and terms. The customer must explicitly accept this quote before checkout opens.
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
                    Internal Notes (Optional)
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

                <div><label htmlFor="quoteScope" className="block text-muted uppercase tracking-widest text-[11px] mb-2">Deliverables and scope</label>
                  <textarea id="quoteScope" value={quoteScope} onChange={(event) => setQuoteScope(event.target.value)} rows={3}
                    className="w-full bg-surface-lowest/60 border border-outline-variant/30 text-text p-3" /></div>
                <div><label htmlFor="quoteTerms" className="block text-muted uppercase tracking-widest text-[11px] mb-2">Cancellation, revisions, and rights terms</label>
                  <textarea id="quoteTerms" value={quoteTerms} onChange={(event) => setQuoteTerms(event.target.value)} rows={3}
                    className="w-full bg-surface-lowest/60 border border-outline-variant/30 text-text p-3" /></div>
                <div className="grid grid-cols-2 gap-3"><div><label htmlFor="deliveryDate" className="block text-muted text-xs mb-2">Estimated delivery</label>
                  <input id="deliveryDate" type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} className="w-full bg-transparent border border-white/20 p-2" /></div>
                  <div><label htmlFor="revisions" className="block text-muted text-xs mb-2">Included revisions</label>
                    <input id="revisions" type="number" min="0" max="20" value={revisions} onChange={(event) => setRevisions(event.target.value)} className="w-full bg-transparent border border-white/20 p-2" /></div></div>

                <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-outline-variant/20">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 py-3.5 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.2em] hover:bg-white transition-all disabled:opacity-50"
                  >
                    {actionLoading ? "Processing..." : "Send quote for acceptance"}
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
            {commission.files?.filter((file) => file.kind === "reference").map((file) =>
              <a key={file.id} href={`/api/commission/file/${file.id}`} target="_blank" rel="noopener noreferrer"
                className="block text-primary underline underline-offset-4 text-sm break-all">{file.file_name} · private file</a>)}
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
                {commission.files?.some((file) => file.kind === "reference") ? "Private references listed above." : "No reference photograph provided."}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="border border-outline-variant/20 p-6 md:p-8 space-y-5">
        <h2 className="font-serif text-2xl">Studio workflow</h2>
        <p className="text-xs text-muted">Request {commission.request_reference || commission.id} · Quote version {commission.quote_version || 0}</p>
        <label htmlFor="studioMessage" className="block text-xs uppercase tracking-widest text-muted">Reply, clarification request, progress update, or reason</label>
        <textarea id="studioMessage" value={studioMessage} onChange={(event) => setStudioMessage(event.target.value)} rows={3}
          className="w-full bg-transparent border border-white/20 p-3" maxLength={2000} />
        <p className="text-xs text-muted">Use the reply action to ask for missing details. Customers can respond from their private tracking page.</p>
        <div className="flex flex-wrap gap-3">
          {(["reply", ...(commission.status === "paid" ? ["start"] : []),
            ...(commission.status === "in_progress" ? ["progress", "ready"] : []),
            ...(commission.status === "revision_requested" ? ["resolve_revision"] : []),
            ...(commission.status === "ready_for_delivery" ? ["deliver"] : []),
            ...(["pending", "under_review", "clarification_requested", "quote_sent", "approved", "expired"].includes(commission.status) ? ["cancel"] : []),
            "rotate_token"]).map((action) =>
              <button key={action} type="button" disabled={actionLoading} onClick={() => void runWorkflowAction(action)}
                className="border border-white/25 px-4 py-2 text-xs uppercase tracking-wider hover:border-primary disabled:opacity-50">
                {action === "reply" ? "Send reply / request clarification" : action.replaceAll("_", " ")}</button>)}
        </div>
        {["in_progress", "revision_requested", "ready_for_delivery", "delivered"].includes(commission.status) &&
          <div className="border-t border-white/15 pt-5 space-y-3">
            <label htmlFor="finalFile" className="block text-sm">Private final artwork (JPG, PNG, WebP, PDF · 25 MB max)</label>
            <input id="finalFile" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(event) => setDeliverable(event.target.files?.[0] || null)} />
            <button type="button" disabled={!deliverable || actionLoading} onClick={() => void uploadFinal()}
              className="block border border-primary px-4 py-2 text-primary disabled:opacity-50">Upload deliverable</button>
          </div>}
        {commission.files?.filter((file) => file.kind === "deliverable").map((file) =>
          <a key={file.id} href={`/api/commission/file/${file.id}`} target="_blank" rel="noopener noreferrer"
            className="block text-primary underline text-sm">{file.file_name} · private deliverable</a>)}
      </section>

      <section className="border border-outline-variant/20 p-6 md:p-8 space-y-4">
        <h2 className="font-serif text-2xl">Activity history</h2>
        {commission.events?.length ? <ol className="space-y-4">{commission.events.map((event) =>
          <li key={event.id} className="border-l border-primary/40 pl-4 text-sm">
            <p className="text-muted text-xs">{new Date(event.created_at).toLocaleString()} · {event.actor_type}</p>
            <p className="capitalize">{event.event_type.replaceAll("_", " ")}</p>
            {event.body && <p className="text-muted whitespace-pre-wrap">{event.body}</p>}
          </li>)}</ol> : <p className="text-muted text-sm">No activity recorded yet.</p>}
      </section>
    </div>
  );
}
