"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaStep, setMfaStep] = useState<"login" | "enroll" | "challenge">("login");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const response = await fetch("/api/admin/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", email, password }),
      });
      const result = await response.json();
      const signInError = response.ok ? null : { message: result.error || "Unable to sign in." };

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const accessCheck = await fetch("/api/admin/commissions?status=auth", { cache: "no-store" });
      if (!accessCheck.ok) {
        await supabase.auth.signOut();
        setError("This account is not authorized to access the studio portal.");
        setLoading(false);
        return;
      }

      const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel === "aal2") {
        router.replace("/admin");
        router.refresh();
      } else {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const enrolled = factors?.totp?.find((factor) => factor.status === "verified");
        if (enrolled) {
          setFactorId(enrolled.id);
          setMfaStep("challenge");
        } else {
          const { data: factor, error: enrollError } = await supabase.auth.mfa.enroll({
            factorType: "totp", friendlyName: "Artfolio studio",
          });
          if (enrollError || !factor?.totp) throw enrollError || new Error("MFA setup failed.");
          setFactorId(factor.id);
          setQrCode(factor.totp.qr_code);
          setManualSecret(factor.totp.secret);
          setMfaStep("enroll");
        }
      }
      setLoading(false);
    } catch {
      setError("Sign-in is unavailable. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY configuration.");
      setLoading(false);
    }
  };

  const verifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId, code: mfaCode.trim(),
      });
      if (verifyError) throw verifyError;
      setManualSecret("");
      setQrCode("");
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("The authenticator code could not be verified. Check the code and retry.");
    } finally {
      setLoading(false);
    }
  };

  const cancelMfa = async () => {
    await createClient().auth.signOut();
    setMfaStep("login");
    setFactorId("");
    setQrCode("");
    setManualSecret("");
    setMfaCode("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-surface-highest/10 border border-outline-variant/30 p-8 md:p-12 shadow-2xl backdrop-blur-md">
        <header className="mb-8 text-center">
          <span className="text-[10px] tracking-[0.3em] uppercase text-primary font-sans block mb-2">
            Curatorial Access Only
          </span>
          <h1 className="font-serif text-3xl md:text-4xl text-text font-normal">
            Studio Portal
          </h1>
          <p className="font-sans text-muted text-xs mt-2 italic">
            {mfaStep === "login" ? "Enter administrative credentials to manage commissions and exhibitions." : "Verify your studio sign-in with an authenticator app."}
          </p>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 border border-red-500/40 bg-red-950/20 text-red-400 text-xs font-sans tracking-wide"
          >
            {error}
          </div>
        )}

        {mfaStep === "login" ? <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block font-sans text-[11px] uppercase tracking-widest text-muted mb-2"
            >
              Curator Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="artist@artfolio.luxury"
              className="w-full bg-surface-lowest/50 border border-outline-variant/30 text-text px-4 py-3 text-sm font-sans focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block font-sans text-[11px] uppercase tracking-widest text-muted mb-2"
            >
              Security Key / Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-lowest/50 border border-outline-variant/30 text-text px-4 py-3 text-sm font-sans focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.25em] hover:bg-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Authenticating Identity..." : "Authorize Access &rarr;"}
          </button>
          <Link href="/admin/recovery" className="block text-center text-xs text-muted underline">Recover studio access</Link>
        </form> : <form onSubmit={verifyMfa} className="space-y-5">
          {mfaStep === "enroll" && <div className="space-y-3 text-center text-sm text-muted">
            <p>Scan this QR code in your authenticator app, then enter its six-digit code.</p>
            {/* Supabase provides this QR as a data URL during factor enrollment. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCode} alt="Authenticator setup QR code" className="mx-auto w-44 h-44 bg-white p-2" />
            <p className="break-all text-xs">Manual setup key: <span className="font-mono text-text">{manualSecret}</span></p>
            <p className="text-xs">Store your recovery method securely before continuing. Account recovery is handled through Supabase administration.</p>
          </div>}
          {mfaStep === "challenge" && <p className="text-sm text-muted">Enter the current code from your authenticator app.</p>}
          <label htmlFor="mfa-code" className="block text-xs text-muted uppercase tracking-wider">Authenticator code</label>
          <input id="mfa-code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className="w-full bg-surface-lowest/50 border border-outline-variant/30 text-text px-4 py-3 text-sm font-sans focus:outline-none focus:border-primary" />
          <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-black text-xs font-semibold uppercase tracking-widest disabled:opacity-50">{loading ? "Verifying…" : "Verify and open studio"}</button>
          <button type="button" onClick={() => void cancelMfa()} className="block mx-auto text-xs text-muted underline">Cancel sign-in</button>
        </form>}

        <footer className="mt-8 text-center pt-6 border-t border-outline-variant/10">
          <Link
            href="/"
            className="text-[11px] text-muted hover:text-text uppercase tracking-widest transition-colors"
          >
            &larr; Return to Public Gallery
          </Link>
        </footer>
      </div>
    </div>
  );
}
