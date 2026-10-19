"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CommissionAccount({ email }: { email: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function changeEmail() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/commission/email/end", { method: "POST" });
      if (!response.ok) throw new Error("Could not end verification.");
      router.refresh();
    } catch {
      setError("Could not change the verified email. Please try again.");
      setBusy(false);
    }
  }

  return <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border border-white/15 px-4 py-3 text-xs text-muted">
    <span>Verified email: <strong className="text-text font-medium">{email}</strong></span>
    <button type="button" onClick={() => void changeEmail()} disabled={busy}
      className="text-primary underline underline-offset-4 disabled:opacity-50">{busy ? "Changing…" : "Use another email"}</button>
    {error && <p role="alert" className="w-full text-red-300">{error}</p>}
  </div>;
}
