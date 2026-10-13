"use client";
import { useState } from "react";
import Link from "next/link";

export default function RecoveryPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [requested, setRequested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requested ? { action: "reset", email, token, password } : { action: "recover", email }) });
      const result = await response.json();
      setMessage(result.message || result.error || "Recovery is unavailable.");
      if (response.ok) { if (requested) { setToken(""); setPassword(""); } else setRequested(true); }
    } catch { setMessage("Recovery is unavailable. Try again later."); }
    finally { setBusy(false); }
  }
  const field = "w-full border border-outline-variant/30 bg-surface-lowest px-4 py-3 text-text";
  return <main className="min-h-screen flex items-center justify-center px-4 py-12">
    <div className="w-full max-w-md space-y-6">
      <h1 className="font-serif text-3xl">Recover studio access</h1>
      <p className="text-sm text-muted">Password recovery keeps your authenticator enabled. For a lost authenticator, contact your Supabase project administrator using your established recovery channel.</p>
      <form onSubmit={submit} className="space-y-4">
        <label htmlFor="recovery-email" className="block">Studio email</label>
        <input id="recovery-email" type="email" autoComplete="email" required readOnly={requested} value={email} onChange={e => setEmail(e.target.value)} className={field} />
        {requested && <>
          <label htmlFor="recovery-code" className="block">Email recovery code</label>
          <input id="recovery-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={token} onChange={e => setToken(e.target.value)} className={field} />
          <label htmlFor="new-password" className="block">New password (at least 12 characters)</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} className={field} />
        </>}
        <button disabled={busy} className="w-full bg-primary text-black py-3 disabled:opacity-50">{busy ? "Please wait…" : requested ? "Change password" : "Send recovery code"}</button>
        {requested && <button type="button" onClick={() => { setRequested(false); setToken(""); setPassword(""); }} className="text-sm underline">Request another code</button>}
      </form>
      {message && <p role="status" className="text-sm">{message}</p>}
      <Link href="/admin/login" className="block text-sm underline">Return to studio sign-in</Link>
    </div>
  </main>;
}
