"use client";

import { useEffect, useState } from "react";

export function CommissionAvailability({ releaseEnabled }: { releaseEnabled: boolean }) {
  const [accepting, setAccepting] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/commission-availability", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.ok && data.success) { setAccepting(data.acceptingRequests === true); setReady(true); }
        else setMessage(data.message || "Availability could not be loaded. Intake remains closed.");
      })
      .catch(() => { if (active) setMessage("Availability could not be loaded. Intake remains closed."); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);

  async function save(next: boolean) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/commission-availability", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acceptingRequests: next }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Availability could not be saved.");
      setAccepting(data.acceptingRequests === true);
      setMessage(next ? "New requests are open." : "New requests are paused.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Availability could not be saved.");
    } finally { setSaving(false); }
  }

  return <section className="border border-white/15 p-5 space-y-3" aria-labelledby="commission-availability-title">
    <h2 id="commission-availability-title" className="font-serif text-xl">Commission requests</h2>
    <p className="text-muted text-sm">Availability is owner-controlled and recorded in the audit history. The deployment release gate remains an independent safety lock.</p>
    <p className="text-sm" role="status">{!loaded ? "Loading availability…" : accepting ? "Requests are open" : "Requests are paused"}</p>
    {!releaseEnabled && <p className="text-amber-300 text-sm">The deployment release gate is closed. Requests cannot be opened until the operator enables it.</p>}
    <button type="button" disabled={!loaded || !ready || saving || (!accepting && !releaseEnabled)}
      onClick={() => void save(!accepting)}
      className="border border-primary px-4 py-2 text-primary text-xs uppercase tracking-wider disabled:opacity-50">
      {saving ? "Saving…" : accepting ? "Pause new requests" : "Open new requests"}
    </button>
    {message && <p className="text-sm text-muted" role="status">{message}</p>}
  </section>;
}
