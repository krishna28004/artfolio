"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

function getRecoveryErrorMessage(cause: unknown, origin: string) {
  const error = cause && typeof cause === "object" ? cause as { message?: unknown; status?: unknown } : null;
  const message = typeof error?.message === "string" ? error.message.toLowerCase() : "";

  if (error?.status === 429 || message.includes("rate limit") || message.includes("too many requests")) {
    return "Supabase has temporarily limited password-reset emails. Wait before requesting another link, then check the inbox and spam folder for the earlier request.";
  }
  if (message.includes("redirect") || message.includes("email link is invalid")) {
    return `Supabase rejected this local return address. In Authentication → URL Configuration, add ${origin}/auth/recovery/callback to Redirect URLs, then request a new email.`;
  }
  if (message.includes("fetch") || message.includes("network") || cause instanceof TypeError) {
    return "Artfolio could not reach Supabase Auth. Check your internet connection and that the local site is using the intended Supabase project.";
  }
  return "Supabase could not accept the password-reset request. Check the local Supabase configuration and try again later.";
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeKind, setNoticeKind] = useState<"success" | "info">("info");
  const [mfaStep, setMfaStep] = useState<"login" | "enroll" | "challenge">("login");
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [manualSecret, setManualSecret] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const checkedExistingSession = useRef(false);

  const finishLogin = useCallback(async () => {
    const response = await fetch("/api/admin/session", { method: "POST", cache: "no-store" });
    if (!response.ok) throw new Error("Studio login notification could not be sent.");
    const result = await response.json() as { expiresAt?: string };
    if (!result.expiresAt) throw new Error("Studio session deadline is unavailable.");
    sessionStorage.setItem("artfolio-studio-expires-at", result.expiresAt);
    router.replace("/admin");
    router.refresh();
  }, [router]);

  const continueSignIn = useCallback(async () => {
    const supabase = createClient();
    const accessCheck = await fetch("/api/admin/commissions?status=auth", { cache: "no-store" });
    if (!accessCheck.ok) {
      await supabase.auth.signOut({ scope: "local" });
      throw new Error("This account is not authorized to access the studio portal.");
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw assuranceError;
    if (assurance?.currentLevel === "aal2") {
      await finishLogin();
      return;
    }
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
  }, [finishLogin]);

  useEffect(() => {
    if (checkedExistingSession.current) return;
    checkedExistingSession.current = true;
    void (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("reset") === "success") {
        setNoticeKind("success");
        setNotice("Password updated. Sign in with your new Artfolio password.");
      }
      if (params.get("error")) {
        setError(params.get("error") === "unauthorized"
          ? "This GitHub account is not authorized for the Studio Portal."
          : "GitHub sign-in did not complete. Please try again.");
        return;
      }
      const { data: { user } } = await createClient().auth.getUser();
      if (!user) return;
      setLoading(true);
      try { await continueSignIn(); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Studio sign-in is unavailable."); }
      finally { setLoading(false); }
    })();
  }, [continueSignIn]);

  const handleGithubLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error: oauthError } = await createClient().auth.signInWithOAuth({
        provider: "github", options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (oauthError) throw oauthError;
    } catch {
      setError("GitHub sign-in could not start. Check the Supabase provider configuration.");
      setLoading(false);
    }
  };

  const requestPasswordRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Enter the curator email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { error: recoveryError } = await createClient().auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/recovery/callback`,
      });
      if (recoveryError) throw recoveryError;
      setNoticeKind("success");
      setNotice("Recovery request accepted. If this curator email is registered, Supabase will send a password reset link. Check your inbox and spam folder; delivery is not confirmed by this message.");
    } catch (cause) {
      setError(getRecoveryErrorMessage(cause, window.location.origin));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError("Unable to verify studio credentials.");
        setLoading(false);
        return;
      }

      setPassword("");
      await continueSignIn();
      setLoading(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Studio sign-in is temporarily unavailable.");
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
      await finishLogin();
    } catch (cause) {
      setError(cause instanceof Error && cause.message.includes("notification")
        ? cause.message : "The authenticator code could not be verified. Check the code and retry.");
    } finally {
      setLoading(false);
    }
  };

  const cancelMfa = async () => {
    const supabase = createClient();
    if (mfaStep === "enroll" && factorId) await supabase.auth.mfa.unenroll({ factorId });
    await supabase.auth.signOut({ scope: "local" });
    sessionStorage.removeItem("artfolio-studio-expires-at");
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
        {notice && (
          <div role="status" aria-live="polite" className={`mb-6 p-4 border text-xs font-sans tracking-wide ${noticeKind === "success" ? "border-green-500/40 bg-green-950/20 text-green-300" : "border-primary/30 bg-primary/5 text-primary"}`}>
            {notice}
          </div>
        )}

        {mfaStep === "login" ? <div className="space-y-5">
          <button
            type="button" onClick={() => void handleGithubLogin()} disabled={loading}
            className="w-full py-4 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.2em] hover:bg-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >{loading ? "Connecting to GitHub…" : "Continue with GitHub"}</button>
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-muted" aria-hidden="true">
            <span className="h-px flex-1 bg-outline-variant/30" /><span>or</span><span className="h-px flex-1 bg-outline-variant/30" />
          </div>
          <button type="button" aria-expanded={showPasswordLogin}
            onClick={() => { setShowPasswordLogin((shown) => !shown); setRecoveryMode(false); setError(null); setNotice(null); }}
            className="w-full text-xs text-muted underline underline-offset-4 hover:text-text">
            {showPasswordLogin ? "Hide email and password sign-in" : "Use email and password instead"}
          </button>
          {showPasswordLogin && (recoveryMode ? <form onSubmit={requestPasswordRecovery} className="space-y-5 pt-2">
            <p id="recovery-email-help" className="text-sm text-muted">Enter your Artfolio curator email. We will request a secure password reset link.</p>
            <div>
              <label htmlFor="recovery-email" className="block font-sans text-[11px] uppercase tracking-widest text-muted mb-2">Curator Email</label>
              <input id="recovery-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" aria-describedby="recovery-email-help" className="w-full bg-[#e9e5dd] border border-[#aaa49a] text-[#171614] placeholder:text-[#68635c] autofill:[-webkit-text-fill-color:#171614] px-4 py-3 text-sm font-sans font-medium focus:outline-none focus:border-primary" />
            </div>
            <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.2em] disabled:opacity-50">
              {loading ? "Sending recovery link…" : "Send recovery link"}
            </button>
            <button type="button" onClick={() => { setRecoveryMode(false); setError(null); setNotice(null); }} className="block mx-auto text-xs text-muted underline">Back to sign in</button>
          </form> : <form onSubmit={handleLogin} className="space-y-5 pt-2">
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
              autoComplete="email"
              className="w-full bg-[#e9e5dd] border border-[#aaa49a] text-[#171614] placeholder:text-[#68635c] autofill:[-webkit-text-fill-color:#171614] px-4 py-3 text-sm font-sans font-medium focus:outline-none focus:border-primary transition-colors"
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
              autoComplete="current-password"
              className="w-full bg-[#e9e5dd] border border-[#aaa49a] text-[#171614] autofill:[-webkit-text-fill-color:#171614] px-4 py-3 text-sm font-sans font-medium focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.25em] hover:bg-white transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Verifying account…" : "Continue with email"}
          </button>
          <button type="button" onClick={() => { setRecoveryMode(true); setError(null); setNotice(null); }} className="block mx-auto text-xs text-muted underline">
            Forgot your Artfolio password?
          </button>
          </form>)}
        </div> : <form onSubmit={verifyMfa} className="space-y-5">
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
