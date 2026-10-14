"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";

type TrackingData = {
  checkoutUrl: string | null;
  commission: { request_reference: string; status: string; name: string; size: string; budget: string;
    deadline: string | null; message: string; price: number | null; currency: string;
    quote_scope: string | null; quote_terms: string | null; estimated_delivery_at: string | null;
    quote_version: number; accepted_quote_version: number | null; revision_allowance: number };
  events: { id: string; actor_type: string; event_type: string; body: string | null; created_at: string }[];
  files: { id: string; kind: string; file_name: string; size_bytes: number; delivered_at: string | null }[];
};

export default function CommissionTrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [feedback, setFeedback] = useState("");

  const reload = async () => {
    const response = await fetch(`/api/commission/track?id=${encodeURIComponent(id)}`, { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) { setError(result.message || "Unable to open this request."); return; }
    setData(result);
    setError("");
  };
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/commission/track?id=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (!response.ok) setError(result.message || "Unable to open this request.");
        else { setData(result); setError(""); }
      })
      .catch((cause) => { if (cause?.name !== "AbortError") setError("Unable to open this request."); });
    return () => controller.abort();
  }, [id]);

  const act = async (action: string, body?: string) => {
    setBusy(true); setFeedback("");
    try {
      const response = await fetch("/api/commission/track/action", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, body, quoteVersion: action === "accept_quote" ? data?.commission.quote_version : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Action failed.");
      setMessage(""); setFeedback("Saved."); await reload();
    } catch (cause) { setFeedback(cause instanceof Error ? cause.message : "Action failed."); }
    finally { setBusy(false); }
  };

  return <main className="min-h-screen bg-background text-text px-5 py-16">
    <div className="max-w-3xl mx-auto space-y-8">
      <Link href="/" className="text-primary text-xs uppercase tracking-widest">← Artfolio</Link>
      <header><p className="text-primary text-xs uppercase tracking-widest">Private commission tracking</p>
        <h1 className="font-serif text-4xl mt-3">{data?.commission.request_reference || "Your request"}</h1>
        <p className="text-muted mt-2" role="status">{error || (data ? `Current status: ${data.commission.status.replaceAll("_", " ")}` : "Loading…")}</p>
      </header>
      {data && <>
        <section className="border border-white/15 p-6 space-y-3">
          <h2 className="font-serif text-2xl">Request details</h2>
          <p>Artwork size: {data.commission.size}</p><p>Budget: {data.commission.budget}</p>
          <p className="whitespace-pre-wrap text-muted">{data.commission.message}</p>
          {data.commission.quote_scope && <div className="pt-3 border-t border-white/10 space-y-2">
            <h3 className="font-serif text-xl">Quote version {data.commission.quote_version}</h3>
            <p>Price: ₹{((data.commission.price || 0) / 100).toLocaleString("en-IN")}</p>
            <p>Scope: {data.commission.quote_scope}</p><p>Terms: {data.commission.quote_terms}</p>
            <p>Included revisions: {data.commission.revision_allowance}</p>
            {data.commission.estimated_delivery_at && <p>Estimated delivery: {new Date(data.commission.estimated_delivery_at).toLocaleDateString()}</p>}
            {data.commission.status === "quote_sent" && <div className="flex gap-3 pt-2">
              <button disabled={busy} onClick={() => void act("accept_quote")} className="border border-primary text-primary px-4 py-2 disabled:opacity-50">Accept quote</button>
              <button disabled={busy} onClick={() => void act("decline_quote")} className="border border-white/25 px-4 py-2 disabled:opacity-50">Decline</button>
            </div>}
          </div>}
          {data.checkoutUrl && <Link href={data.checkoutUrl} className="inline-block border border-primary text-primary px-4 py-2">Proceed to secure checkout</Link>}
        </section>
        <section className="border border-white/15 p-6 space-y-4">
          <h2 className="font-serif text-2xl">Message the studio</h2>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000}
            className="w-full min-h-28 bg-transparent border border-white/20 p-3" aria-label="Message to the studio" />
          <div className="flex flex-wrap gap-3">
            <button disabled={busy || message.trim().length < 3} onClick={() => void act("message", message)} className="border border-primary text-primary px-4 py-2 disabled:opacity-50">Send message</button>
            {data.commission.status === "quote_sent" && <button disabled={busy || message.trim().length < 3} onClick={() => void act("request_clarification", message)} className="border border-white/25 px-4 py-2 disabled:opacity-50">Request clarification</button>}
            {["paid", "in_progress", "revision_requested", "ready_for_delivery", "delivered"].includes(data.commission.status) &&
              <button disabled={busy || message.trim().length < 3} onClick={() => void act("request_refund", message)} className="border border-white/25 px-4 py-2 disabled:opacity-50">Request refund review</button>}
            {data.commission.status === "in_progress" && <button disabled={busy || message.trim().length < 3} onClick={() => void act("request_revision", message)} className="border border-white/25 px-4 py-2 disabled:opacity-50">Request revision</button>}
            {data.commission.status === "delivered" && <>
              <button disabled={busy} onClick={() => void act("complete")} className="border border-primary text-primary px-4 py-2 disabled:opacity-50">Mark complete</button>
              <button disabled={busy || message.trim().length < 3} onClick={() => void act("delivery_issue", message)} className="border border-white/25 px-4 py-2 disabled:opacity-50">Report issue</button>
            </>}
          </div><p role="status" className="text-sm text-muted">{feedback}</p>
        </section>
        {data.files.some((file) => file.kind === "deliverable") && <section className="border border-white/15 p-6 space-y-3">
          <h2 className="font-serif text-2xl">Delivered files</h2>
          {data.files.filter((file) => file.kind === "deliverable").map((file) => <a key={file.id}
            href={`/api/commission/file/${file.id}?commissionId=${id}`} className="block text-primary underline underline-offset-4">{file.file_name}</a>)}
        </section>}
        <section className="border border-white/15 p-6 space-y-4"><h2 className="font-serif text-2xl">Activity</h2>
          {data.events.length === 0 ? <p className="text-muted">No updates yet.</p> :
            <ol className="space-y-4">{data.events.map((event) => <li key={event.id} className="border-l border-primary/40 pl-4">
              <p className="text-xs text-muted">{new Date(event.created_at).toLocaleString()} · {event.actor_type}</p>
              <p className="capitalize">{event.event_type.replaceAll("_", " ")}</p>
              {event.body && <p className="text-muted whitespace-pre-wrap">{event.body}</p>}
            </li>)}</ol>}
        </section>
      </>}
    </div>
  </main>;
}
