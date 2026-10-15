"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"verify" | "password">("verify");
  const [message, setMessage] = useState<string | null>(null);
  const [messageKind, setMessageKind] = useState<"error" | "success">("error");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("recovery") === "1") {
      void createClient().auth.getUser().then(({ data }) => {
        if (data.user) setStep("password");
        else setMessage("The recovery session could not be restored. Request a new recovery email and enter its code below.");
      });
    }
  }, []);

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: email.trim(), token: token.trim() }),
      });
      const result = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !result.success) throw new Error(result.message || "The recovery code could not be verified.");
      setMessageKind("success");
      setMessage("Code verified. Choose a new password.");
      setStep("password");
    } catch (cause) {
      setMessageKind("error");
      setMessage(cause instanceof Error ? cause.message : "The recovery code could not be verified. Request a new email and try again.");
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 12) {
      setMessageKind("error");
      return setMessage("Use at least 12 characters for the new password.");
    }
    if (password !== confirmation) {
      setMessageKind("error");
      return setMessage("The password confirmation does not match.");
    }
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessageKind("error");
      setMessage("The recovery session expired before the password was saved. Request a new recovery email and enter its code.");
      setLoading(false);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/admin/login?reset=success");
    router.refresh();
  };

  return <main className="min-h-screen bg-background flex items-center justify-center px-4 py-12 text-text">
    <section className="w-full max-w-md bg-surface-highest/10 border border-outline-variant/30 p-8 md:p-12 shadow-2xl backdrop-blur-md">
      <span className="text-[10px] tracking-[0.3em] uppercase text-primary font-sans block mb-2">Curatorial Access Only</span>
      <h1 className="font-serif text-3xl text-text">Set a new password</h1>
      <p className="font-sans text-muted text-sm mt-3">Choose a new Artfolio password for the Studio Portal.</p>
      {step === "verify" && <form onSubmit={verifyCode} className="mt-8 space-y-5">
        <p className="text-sm text-muted">Enter the curator email and the one-time code from your newest recovery email. Codes can only be used once.</p>
        {message && <p role="status" aria-live="polite" className={`text-sm ${messageKind === "success" ? "text-green-400" : "text-red-400"}`}>{message}</p>}
        <div><label htmlFor="recovery-email" className="block text-[11px] uppercase tracking-widest text-muted mb-2">Curator email</label><input id="recovery-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-[#e9e5dd] border border-[#aaa49a] text-[#171614] placeholder:text-[#68635c] px-4 py-3 text-sm focus:outline-none focus:border-primary" /></div>
        <div><label htmlFor="recovery-code" className="block text-[11px] uppercase tracking-widest text-muted mb-2">Email recovery code</label><input id="recovery-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" minLength={6} maxLength={8} required value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 8))} className="w-full bg-[#e9e5dd] border border-[#aaa49a] text-[#171614] placeholder:text-[#68635c] px-4 py-3 text-lg tracking-[0.25em] focus:outline-none focus:border-primary" /></div>
        <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.2em] disabled:opacity-50">{loading ? "Verifying code…" : "Verify recovery code"}</button>
      </form>}
      {step === "password" && <form onSubmit={updatePassword} className="mt-8 space-y-5">
        {message && <p role="status" aria-live="polite" className={`text-sm ${messageKind === "success" ? "text-green-400" : "text-red-400"}`}>{message}</p>}
        <div><label htmlFor="new-password" className="block text-[11px] uppercase tracking-widest text-muted mb-2">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-surface-lowest/50 border border-outline-variant/30 text-text px-4 py-3 text-sm focus:outline-none focus:border-primary" /></div>
        <div><label htmlFor="confirm-password" className="block text-[11px] uppercase tracking-widest text-muted mb-2">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="w-full bg-surface-lowest/50 border border-outline-variant/30 text-text px-4 py-3 text-sm focus:outline-none focus:border-primary" /></div>
        <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.2em] disabled:opacity-50">{loading ? "Updating password…" : "Save new password"}</button>
      </form>}
      <Link href="/admin/login" className="block mt-8 text-center text-xs text-muted underline">Return to Studio sign-in</Link>
    </section>
  </main>;
}
