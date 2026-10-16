"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock3, Image, Inbox, IndianRupee, RefreshCw } from "lucide-react";
import { formatRupees } from "@/shared/utils/money";

interface CommissionSummary {
  id: string;
  name: string;
  email: string;
  status: string;
  budget: string;
  price: number | null;
  created_at: string;
}

const statusStyles: Record<string, string> = {
  pending: "border-amber-300/20 bg-amber-300/[0.08] text-amber-200",
  approved: "border-sky-300/20 bg-sky-300/[0.08] text-sky-200",
  paid: "border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-200",
  fulfilled: "border-violet-300/20 bg-violet-300/[0.08] text-violet-200",
  rejected: "border-rose-300/20 bg-rose-300/[0.08] text-rose-200",
  expired: "border-white/10 bg-white/[0.035] text-white/50",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function StatusPill({ status }: { status: string }) {
  return <span className={`inline-flex items-center border px-2.5 py-1 text-[9px] font-medium uppercase tracking-[0.15em] ${statusStyles[status] || "border-white/10 bg-white/[0.035] text-white/55"}`}>
    <span className="mr-2 h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />{status.replaceAll("_", " ")}
  </span>;
}

export default function AdminDashboardPage() {
  const [commissions, setCommissions] = useState<CommissionSummary[]>([]);
  const [artworksCount, setArtworksCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadDashboardData() {
      setLoading(true);
      setLoadError(false);
      try {
        const [commRes, artRes] = await Promise.all([
          fetch("/api/admin/commissions", { cache: "no-store" }),
          fetch("/api/admin/artworks", { cache: "no-store" }),
        ]);
        if (!commRes.ok || !artRes.ok) throw new Error("Dashboard data unavailable");
        const [commData, artData] = await Promise.all([commRes.json(), artRes.json()]);
        if (!commData.success || !Array.isArray(commData.data) || !artData.success || !Array.isArray(artData.data)) {
          throw new Error("Dashboard response was incomplete");
        }
        if (active) {
          setCommissions(commData.data);
          setArtworksCount(artData.data.length);
        }
      } catch {
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadDashboardData();
    return () => { active = false; };
  }, [refreshKey]);

  const pendingCount = commissions.filter((commission) => commission.status === "pending").length;
  const approvedCount = commissions.filter((commission) => commission.status === "approved").length;
  const paidCommissions = commissions.filter((commission) => commission.status === "paid" || commission.status === "fulfilled");
  const paidCommissionValue = paidCommissions.reduce((sum, commission) => sum + (commission.price || 0), 0);
  const stats = [
    { label: "Needs your review", value: pendingCount, note: "Requests awaiting a quote or response", href: "/admin/commissions", icon: Inbox, accent: "text-amber-200", mark: "bg-amber-200" },
    { label: "Awaiting payment", value: approvedCount, note: "Approved requests with an open payment window", href: "/admin/commissions", icon: Clock3, accent: "text-sky-200", mark: "bg-sky-200" },
    { label: "Paid commission value", value: formatRupees(paidCommissionValue), note: `${paidCommissions.length} paid or fulfilled commissions`, href: "/admin/payments", icon: IndianRupee, accent: "text-primary", mark: "bg-primary" },
    { label: "Catalog artworks", value: artworksCount ?? 0, note: "Works managed in your collection", href: "/admin/artworks", icon: Image, accent: "text-white/90", mark: "bg-white/80" },
  ];

  return (
    <div className="space-y-8 sm:space-y-10">
      <header className="flex flex-col gap-6 border-b border-white/[0.09] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-3">
            <span className="h-px w-8 bg-primary/75" />
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-primary">Studio overview</p>
          </div>
          <h1 className="font-serif text-4xl font-normal tracking-[-0.025em] text-white sm:text-5xl">Artist Executive Desk</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/50">A clear view of new collector requests, your catalog, and commission activity.</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/admin/commissions" className="inline-flex min-h-11 items-center gap-3 bg-primary px-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#111] transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Review queue <span className="flex h-6 min-w-6 items-center justify-center border border-black/15 px-1">{loading ? "—" : pendingCount}</span>
          </Link>
          <Link href="/admin/artworks" className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-4 text-[10px] font-medium uppercase tracking-[0.15em] text-white/70 transition hover:border-white/35 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            Open catalog <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </header>

      {loadError && <div role="alert" className="flex flex-col gap-3 border border-rose-300/20 bg-rose-300/[0.045] p-4 text-sm text-rose-100 sm:flex-row sm:items-center sm:justify-between">
        <span>Studio overview could not load. Your saved records are unchanged; try again.</span>
        <button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="inline-flex min-h-9 items-center gap-2 self-start border border-rose-200/20 px-3 text-xs hover:bg-rose-200/[0.06] sm:self-auto"><RefreshCw size={13} /> Try again</button>
      </div>}

      <section aria-label="Studio summary" aria-busy={loading} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, href, icon: Icon, accent, mark }) => (
          <Link key={label} href={href} className={`group relative flex min-h-[168px] flex-col justify-between overflow-hidden border border-white/[0.09] bg-gradient-to-br from-white/[0.045] to-transparent p-5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-white/[0.055] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-6 ${loading ? "animate-pulse" : ""}`}>
            <span className={`absolute left-0 top-0 h-px w-12 ${mark}`} aria-hidden="true" />
            <div className="flex items-start justify-between gap-4">
              <p className="max-w-[15rem] text-[10px] font-medium uppercase leading-5 tracking-[0.17em] text-white/50">{label}</p>
              <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center border border-white/[0.08] bg-black/20 ${accent}`}><Icon size={16} strokeWidth={1.6} aria-hidden="true" /></span>
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <div>
                <p className={`font-serif text-3xl font-normal leading-none tracking-tight ${accent}`}>
                  {loading ? <span className="inline-block h-8 w-12 bg-white/[0.08]" aria-label="Loading" /> : loadError ? "—" : value}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-white/45">{loading ? "Loading summary…" : loadError ? "Unavailable until refreshed" : note}</p>
              </div>
              <ArrowRight size={15} className="mb-1 shrink-0 text-white/25 transition group-hover:translate-x-1 group-hover:text-primary" aria-hidden="true" />
            </div>
            <span className="sr-only">Open {label}</span>
          </Link>
        ))}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section aria-labelledby="recent-inquiries-title" className="min-w-0 border border-white/[0.09] bg-white/[0.018]">
          <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <p className="text-[9px] uppercase tracking-[0.22em] text-white/35">Collector activity</p>
              <h2 id="recent-inquiries-title" className="mt-1 font-serif text-2xl font-normal text-white/90">Recent inquiries</h2>
            </div>
            <Link href="/admin/commissions" className="inline-flex min-h-9 items-center gap-2 self-start text-[10px] font-medium uppercase tracking-[0.14em] text-primary transition hover:text-white sm:self-auto">
              All inquiries <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>

          {loading ? <div className="space-y-3 p-5 sm:p-6" aria-label="Loading inquiries">
            {[0, 1, 2].map((row) => <div key={row} className="h-[62px] animate-pulse border border-white/[0.06] bg-white/[0.025]" />)}
          </div> : commissions.length === 0 ? <div className="px-6 py-14 text-center">
            <span className="mx-auto inline-flex h-12 w-12 items-center justify-center border border-white/10 text-white/40"><Inbox size={19} strokeWidth={1.5} /></span>
            <h3 className="mt-4 font-serif text-xl text-white/85">No inquiries yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/45">New commission requests from your public site will appear here for review.</p>
            <Link href="/admin/commissions" className="mt-5 inline-flex items-center gap-2 text-xs text-primary hover:text-white">Open commission queue <ArrowRight size={14} /></Link>
          </div> : <>
            <div className="divide-y divide-white/[0.07] md:hidden">
              {commissions.slice(0, 6).map((commission) => <Link key={commission.id} href={`/admin/commissions/${commission.id}`} className="block px-5 py-4 transition hover:bg-white/[0.035] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-white/90">{commission.name}</p><p className="mt-1 truncate text-xs text-white/45">{commission.email}</p></div>
                  <StatusPill status={commission.status} />
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/45">
                  <span className="font-mono text-white/70">{commission.price ? formatRupees(commission.price) : commission.budget || "No budget shared"}</span>
                  <time dateTime={commission.created_at}>{formatDate(commission.created_at)}</time>
                </div>
              </Link>)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[620px] text-left">
                <thead><tr className="border-b border-white/[0.08] text-[9px] uppercase tracking-[0.17em] text-white/35">
                  <th scope="col" className="px-6 py-3.5 font-medium">Collector</th>
                  <th scope="col" className="px-4 py-3.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3.5 font-medium">Budget / quote</th>
                  <th scope="col" className="px-4 py-3.5 font-medium">Received</th>
                  <th scope="col" className="px-6 py-3.5 text-right font-medium"><span className="sr-only">Open inquiry</span></th>
                </tr></thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {commissions.slice(0, 8).map((commission) => <tr key={commission.id} className="group transition hover:bg-white/[0.025]">
                    <td className="px-6 py-4"><p className="text-sm font-medium text-white/85">{commission.name}</p><p className="mt-1 text-xs text-white/40">{commission.email}</p></td>
                    <td className="px-4 py-4"><StatusPill status={commission.status} /></td>
                    <td className="px-4 py-4 font-mono text-xs text-white/70">{commission.price ? formatRupees(commission.price) : commission.budget || "—"}</td>
                    <td className="px-4 py-4 text-xs text-white/45"><time dateTime={commission.created_at}>{formatDate(commission.created_at)}</time></td>
                    <td className="px-6 py-4 text-right"><Link href={`/admin/commissions/${commission.id}`} aria-label={`Inspect inquiry from ${commission.name}`} className="inline-flex h-9 items-center gap-2 border border-white/10 px-3 text-[9px] uppercase tracking-[0.13em] text-white/55 transition hover:border-primary/40 hover:text-primary">Inspect <ArrowUpRight size={13} /></Link></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          </>}
        </section>

        <aside className="space-y-4">
          <section className="border border-primary/20 bg-primary/[0.035] p-5 sm:p-6">
            <p className="text-[9px] uppercase tracking-[0.22em] text-primary/75">Next step</p>
            <h2 className="mt-3 font-serif text-2xl font-normal leading-tight text-white/90">{loading ? "Review your studio" : loadError ? "Overview unavailable" : pendingCount > 0 ? `${pendingCount} ${pendingCount === 1 ? "inquiry needs" : "inquiries need"} your attention` : "Your queue is clear"}</h2>
            <p className="mt-2 text-xs leading-5 text-white/50">Review requests, prepare a quote, and keep collectors updated from one place.</p>
            <Link href="/admin/commissions" className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 bg-primary px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-white">Go to commission queue <ArrowRight size={14} /></Link>
          </section>
          <section className="border border-white/[0.09] p-5 sm:p-6">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/35">Studio shortcuts</p>
            <div className="mt-3 divide-y divide-white/[0.07]">
              {[
                { label: "Manage artworks", detail: "Publication and catalog", href: "/admin/artworks" },
                { label: "Payment records", detail: "Captured and pending events", href: "/admin/payments" },
                { label: "Recent activity", detail: "Owner actions and updates", href: "/admin/audit" },
              ].map((item) => <Link key={item.href} href={item.href} className="group flex min-h-[60px] items-center justify-between gap-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                <span><span className="block text-xs text-white/80 transition group-hover:text-primary">{item.label}</span><span className="mt-1 block text-[10px] text-white/40">{item.detail}</span></span>
                <ArrowUpRight size={14} className="shrink-0 text-white/30 transition group-hover:text-primary" aria-hidden="true" />
              </Link>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
