"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export default function CommissionRecoverPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status === "submitting") return;

    setStatus("submitting");
    setErrorMessage("");

    try {
      const res = await fetch("/api/commission/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 429) {
        setStatus("error");
        setErrorMessage(data?.message || "Too many recovery attempts. Please wait a few minutes before trying again.");
        return;
      }

      if (!res.ok && res.status !== 200) {
        setStatus("error");
        setErrorMessage(data?.message || "Unable to process recovery. Please verify your email format.");
        return;
      }

      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Network error. Please check your connection and try again.");
    }
  };

  return (
    <main className="flex-1 flex flex-col bg-background text-text min-h-screen">
      <div className="w-full max-w-[580px] mx-auto px-4 sm:px-6 pt-28 pb-28 md:pt-36 md:pb-36 flex flex-col">
        {/* Navigation Back */}
        <div className="mb-8">
          <Link
            href="/commission"
            className="inline-flex items-center gap-2 text-[12px] font-sans tracking-[0.16em] uppercase text-muted hover:text-text transition-colors duration-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Commissions</span>
          </Link>
        </div>

        {/* Header */}
        <header className="mb-10 text-left">
          <p className="font-sans text-[11px] tracking-[0.28em] uppercase text-primary mb-3">
            Inquiry Assistance
          </p>
          <h1 className="font-serif text-[32px] sm:text-[40px] text-text font-normal leading-[1.15] tracking-[-0.02em] mb-4">
            Find Your Commission
          </h1>
          <p className="font-sans text-[14px] sm:text-[15px] text-muted font-light leading-relaxed">
            Enter the email address used during your commission inquiry. If active inquiries are on file, a secure private tracking link will be delivered to your inbox.
          </p>
        </header>

        {/* Card Container */}
        <div className="p-6 sm:p-8 rounded-xl border border-border/40 bg-surface/30 backdrop-blur-md shadow-2xl">
          {status === "success" ? (
            <div className="py-4 text-center space-y-4" role="status" aria-live="polite">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="font-serif text-[22px] text-text font-normal">
                Check Your Inbox
              </h2>
              <p className="font-sans text-[14px] text-muted leading-relaxed max-w-[420px] mx-auto">
                If an active commission inquiry is linked to <strong className="text-text font-medium">{email}</strong>, you will receive an email shortly containing a secure, single-click link to access your tracking portal.
              </p>
              <div className="pt-4 border-t border-border/30 flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setStatus("idle");
                    setEmail("");
                  }}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-sans tracking-[0.08em] border border-border/60 hover:border-text/60 text-muted hover:text-text transition-colors"
                >
                  Enter another email
                </button>
                <Link
                  href="/"
                  className="px-5 py-2.5 rounded-lg text-[13px] font-sans tracking-[0.08em] bg-surface border border-border/40 text-text hover:bg-surface/80 transition-colors inline-flex items-center justify-center"
                >
                  Return to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="recovery-email"
                  className="block text-[12px] font-sans tracking-[0.12em] uppercase text-muted"
                >
                  Collector Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="recovery-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collector@example.com"
                    autoComplete="email"
                    disabled={status === "submitting"}
                    className="w-full pl-10 pr-4 py-3 bg-surface/50 border border-border/60 rounded-lg text-[14px] text-text placeholder:text-muted/50 focus:outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/80 transition-all duration-200"
                  />
                </div>
              </div>

              {status === "error" && (
                <div
                  className="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[13px] flex items-start gap-2.5"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "submitting" || !email.trim()}
                className="w-full py-3.5 px-6 rounded-lg bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-sans text-[13px] tracking-[0.16em] uppercase font-medium shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching records...</span>
                  </>
                ) : (
                  <span>Send Access Link</span>
                )}
              </button>

              <p className="text-[12px] font-sans text-muted/70 text-center leading-relaxed">
                To safeguard privacy, we never publicly disclose whether an email address exists in the studio archives.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
