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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to authenticate.");
      setLoading(false);
    }
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
            Enter administrative credentials to manage commissions and exhibitions.
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

        <form onSubmit={handleLogin} className="space-y-6">
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
        </form>

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
