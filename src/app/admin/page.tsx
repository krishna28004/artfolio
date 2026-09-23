"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

export default function AdminDashboardPage() {
  const [commissions, setCommissions] = useState<CommissionSummary[]>([]);
  const [artworksCount, setArtworksCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const [commRes, artRes] = await Promise.all([
          fetch("/api/admin/commissions"),
          fetch("/api/admin/artworks"),
        ]);

        if (commRes.ok) {
          const commData = await commRes.json();
          if (commData.success && Array.isArray(commData.data)) {
            setCommissions(commData.data);
          }
        }

        if (artRes.ok) {
          const artData = await artRes.json();
          if (artData.success && Array.isArray(artData.data)) {
            setArtworksCount(artData.data.length);
          }
        }
      } catch (err) {
        console.warn("[ADMIN_DASHBOARD_FETCH_ERROR]", err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const pendingCount = commissions.filter((c) => c.status === "pending").length;
  const approvedCount = commissions.filter((c) => c.status === "approved").length;
  const paidCommissions = commissions.filter((c) => c.status === "paid" || c.status === "fulfilled");
  const totalRevenuePaise = paidCommissions.reduce((sum, c) => sum + (c.price || 0), 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-950/40 text-amber-400 border-amber-600/30";
      case "approved":
        return "bg-blue-950/40 text-blue-400 border-blue-600/30";
      case "paid":
        return "bg-emerald-950/40 text-emerald-400 border-emerald-600/30";
      case "fulfilled":
        return "bg-purple-950/40 text-purple-400 border-purple-600/30";
      case "rejected":
        return "bg-red-950/40 text-red-400 border-red-600/30";
      case "expired":
        return "bg-neutral-900 text-neutral-400 border-neutral-700/30";
      default:
        return "bg-surface-highest/20 text-muted border-outline-variant/30";
    }
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-outline-variant/20">
        <div>
          <span className="text-[10px] tracking-[0.3em] uppercase text-primary font-sans block mb-1">
            Studio Overview
          </span>
          <h1 className="font-serif text-3xl md:text-4xl text-text font-normal">
            Artist Executive Desk
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/commissions"
            className="px-5 py-2.5 bg-primary text-black text-[11px] font-semibold uppercase tracking-widest hover:bg-white transition-colors"
          >
            Review Queue ({pendingCount})
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-surface-highest/5 border border-outline-variant/20 backdrop-blur-sm">
          <p className="font-sans text-[11px] uppercase tracking-widest text-muted">Pending Review</p>
          <p className="font-serif text-3xl text-amber-400 mt-3 font-normal">{loading ? "..." : pendingCount}</p>
          <p className="font-sans text-[11px] text-muted mt-1">Requires quote or response</p>
        </div>

        <div className="p-6 bg-surface-highest/5 border border-outline-variant/20 backdrop-blur-sm">
          <p className="font-sans text-[11px] uppercase tracking-widest text-muted">Approved & Awaiting Payment</p>
          <p className="font-serif text-3xl text-blue-400 mt-3 font-normal">{loading ? "..." : approvedCount}</p>
          <p className="font-sans text-[11px] text-muted mt-1">Token-gated 24h window</p>
        </div>

        <div className="p-6 bg-surface-highest/5 border border-outline-variant/20 backdrop-blur-sm">
          <p className="font-sans text-[11px] uppercase tracking-widest text-muted">Total Acquired Revenue</p>
          <p className="font-serif text-3xl text-primary mt-3 font-normal">
            {loading ? "..." : formatRupees(totalRevenuePaise)}
          </p>
          <p className="font-sans text-[11px] text-muted mt-1">{paidCommissions.length} bespoke commissions paid</p>
        </div>

        <div className="p-6 bg-surface-highest/5 border border-outline-variant/20 backdrop-blur-sm">
          <p className="font-sans text-[11px] uppercase tracking-widest text-muted">Catalog Artworks</p>
          <p className="font-serif text-3xl text-text mt-3 font-normal">{loading ? "..." : artworksCount}</p>
          <p className="font-sans text-[11px] text-muted mt-1">Curated portfolio exhibits</p>
        </div>
      </div>

      {/* Recent Commissions Table */}
      <section className="bg-surface-highest/5 border border-outline-variant/20 p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-xl text-text font-normal">Recent Inquiries</h2>
          <Link
            href="/admin/commissions"
            className="text-[11px] uppercase tracking-widest text-primary hover:text-white transition-colors"
          >
            View All Inquiries &rarr;
          </Link>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted font-sans text-xs tracking-widest uppercase">
            Loading Studio Records...
          </div>
        ) : commissions.length === 0 ? (
          <div className="py-16 text-center text-muted font-sans text-xs tracking-widest uppercase">
            No inquiries recorded in the database yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Collector</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Budget / Quote</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-text">
                {commissions.slice(0, 8).map((c) => (
                  <tr key={c.id} className="hover:bg-surface-highest/10 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium text-text">{c.name}</div>
                      <div className="text-muted text-[11px]">{c.email}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 text-[10px] uppercase tracking-widest border ${getStatusBadge(
                          c.status
                        )}`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px]">
                      {c.price ? formatRupees(c.price) : c.budget}
                    </td>
                    <td className="py-4 px-4 text-muted text-[11px]">
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        href={`/admin/commissions/${c.id}`}
                        className="px-3 py-1.5 border border-outline-variant/30 text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-colors inline-block"
                      >
                        Inspect &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
