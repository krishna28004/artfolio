"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export function CommissionAuth({ acceptingRequests }: { acceptingRequests: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/commission/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success || !result.challengeId) {
        setError(result?.message || "We could not send a code right now. Please try again later.");
        return;
      }
      setChallengeId(result.challengeId);
      setSentTo(address);
      setCode("");
      setNotice(`A six-digit code was sent to ${address}. Check your inbox and spam folder. It expires in 10 minutes.`);
    } catch {
      setError("We could not send a code right now. Check the address or try again later.");
    } finally { setBusy(false); }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/commission/email/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: sentTo, code, challengeId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        setError(result?.message || "The code could not be verified. Request a new one if it expired.");
        return;
      }
      setCode("");
      router.refresh();
    } catch {
      setError("Verification is unavailable right now. Please try again.");
    } finally { setBusy(false); }
  }

  return <section className="mx-auto w-full max-w-md border border-white/20 bg-white/[0.025] p-6 sm:p-9" aria-labelledby="commission-email-title">
    <p className="mb-3 text-[10px] uppercase tracking-[0.24em] text-primary">Private commission access</p>
    <h2 id="commission-email-title" className="font-serif text-3xl text-text">Verify your email</h2>
    <p className="mt-3 text-sm leading-relaxed text-muted">Enter your email, then type the one-time code we send you. No password or account is needed.</p>
    {!acceptingRequests && <p role="status" className="mt-5 border border-primary/30 p-3 text-sm text-primary">The studio has paused new requests. You can verify your email, but submissions will open when the studio resumes intake.</p>}
    {error && <p role="alert" className="mt-5 border border-red-500/40 bg-red-950/20 p-3 text-sm text-red-300">{error}</p>}
    {notice && <p role="status" className="mt-5 border border-green-500/40 bg-green-950/20 p-3 text-sm text-green-300">{notice}</p>}
    {!sentTo ? <form onSubmit={(event) => void sendCode(event)} className="mt-7 space-y-5">
      <div><label htmlFor="commission-auth-email" className="mb-2 block text-[11px] uppercase tracking-widest text-muted">Your email</label>
        <input id="commission-auth-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)}
          className="w-full border border-white/20 bg-white/[0.04] px-4 py-3 text-text focus:border-primary focus:outline-none" /></div>
      <button type="submit" disabled={busy} className="w-full bg-[#F5F2EB] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#0C0C0E] hover:bg-[#E8E0D2] disabled:opacity-50">
        {busy ? "Requesting code…" : "Send verification code"}
      </button>
    </form> : <form onSubmit={(event) => void verifyCode(event)} className="mt-7 space-y-5">
      <p className="text-sm text-muted">Code sent to <strong className="font-medium text-text">{sentTo}</strong></p>
      <div><label htmlFor="commission-auth-code" className="mb-2 block text-[11px] uppercase tracking-widest text-muted">Email verification code</label>
        <input id="commission-auth-code" type="text" required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}"
          minLength={6} maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-full border border-white/20 bg-white/[0.04] px-4 py-3 tracking-[0.3em] text-text focus:border-primary focus:outline-none" /></div>
      <button type="submit" disabled={busy} className="w-full bg-[#F5F2EB] px-5 py-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#0C0C0E] hover:bg-[#E8E0D2] disabled:opacity-50">
        {busy ? "Verifying…" : "Verify and open commissions"}
      </button>
      <button type="button" disabled={busy} onClick={() => { setSentTo(""); setChallengeId(""); setCode(""); setError(""); setNotice(""); }}
        className="text-xs text-muted underline underline-offset-4 hover:text-text disabled:opacity-50">Change email or request another code</button>
    </form>}
  </section>;
}
