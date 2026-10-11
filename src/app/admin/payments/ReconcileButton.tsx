"use client";

import { useState } from "react";

export function ReconcileButton({ commissionId }: { commissionId: string }) {
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  const inspect = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/payment-reconcile?commissionId=${commissionId}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Inspection failed.");
      const data = result.data;
      setReport(`Gateway order: ${data.gatewayOrder?.status || "none"}; captured payments: ${data.gatewayPayments.filter((payment: { status: string }) => payment.status === "captured").length}; database status: ${data.commission.status}.`);
    } catch (error) { setReport(error instanceof Error ? error.message : "Inspection failed."); }
    finally { setBusy(false); }
  };
  const reconcile = async () => {
    if (!window.confirm("Record the independently verified captured gateway payment in the database? No charge or refund will be initiated.")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/admin/payment-reconcile", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commissionId }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Reconciliation failed.");
      setReport("Captured payment reconciled. Refresh to see the latest records.");
    } catch (error) { setReport(error instanceof Error ? error.message : "Reconciliation failed."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-2"><div className="flex gap-2">
    <button disabled={busy} onClick={() => void inspect()} className="border border-white/25 px-3 py-1 text-xs disabled:opacity-50">Inspect gateway</button>
    <button disabled={busy} onClick={() => void reconcile()} className="border border-primary text-primary px-3 py-1 text-xs disabled:opacity-50">Reconcile capture</button>
  </div><p role="status" className="text-muted text-xs">{report}</p></div>;
}
