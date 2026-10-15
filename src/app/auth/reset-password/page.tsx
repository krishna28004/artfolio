"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [validLink, setValidLink] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void createClient().auth.getUser().then(({ data }) => {
      setValidLink(Boolean(data.user) && !new URLSearchParams(window.location.search).has("error"));
    });
  }, []);

  const updatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password.length < 12) return setMessage("Use at least 12 characters for the new password.");
    if (password !== confirmation) return setMessage("The password confirmation does not match.");
    setLoading(true);
    setMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setMessage("This recovery link is invalid or has expired. Request a new one from the Studio Portal.");
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
      {validLink === null && <p className="mt-6 text-sm text-muted">Checking recovery link…</p>}
      {validLink === false && <p role="alert" className="mt-6 text-sm text-red-400">This recovery link is invalid or has expired. Request a new link from the Studio Portal.</p>}
      {validLink && <form onSubmit={updatePassword} className="mt-8 space-y-5">
        {message && <p role="alert" className="text-sm text-red-400">{message}</p>}
        <div><label htmlFor="new-password" className="block text-[11px] uppercase tracking-widest text-muted mb-2">New password</label><input id="new-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-surface-lowest/50 border border-outline-variant/30 text-text px-4 py-3 text-sm focus:outline-none focus:border-primary" /></div>
        <div><label htmlFor="confirm-password" className="block text-[11px] uppercase tracking-widest text-muted mb-2">Confirm new password</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="w-full bg-surface-lowest/50 border border-outline-variant/30 text-text px-4 py-3 text-sm focus:outline-none focus:border-primary" /></div>
        <button type="submit" disabled={loading} className="w-full py-4 bg-primary text-black font-sans uppercase text-[11px] font-semibold tracking-[0.2em] disabled:opacity-50">{loading ? "Updating password…" : "Save new password"}</button>
      </form>}
      <Link href="/admin/login" className="block mt-8 text-center text-xs text-muted underline">Return to Studio sign-in</Link>
    </section>
  </main>;
}
