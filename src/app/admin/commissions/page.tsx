"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatRupees } from "@/shared/utils/money";

interface CommissionItem {
  id: string;
  name: string;
  email: string;
  status: string;
  size: string;
  budget: string;
  price: number | null;
  created_at: string;
  expires_at: string | null;
}

export default function AdminCommissionsQueuePage() {
  const [commissions, setCommissions] = useState<CommissionItem[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCommissions() {
      setLoading(true);
      try {
        const url = filter === "all" ? "/api/admin/commissions" : `/api/admin/commissions?status=${filter}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setCommissions(data.data);
          }
        }
      } catch (err) {
        console.warn("[ADMIN_QUEUE_FETCH_ERROR]", err);
      } finally {
        setLoading(false);
      }
    }

    fetchCommissions();
  }, [filter]);

  const filterTabs = [
    { id: "all", label: "All Inquiries" },
    { id: "pending", label: "Pending Review" },
    { id: "approved", label: "Approved" },
    { id: "paid", label: "Paid" },
    { id: "fulfilled", label: "Fulfilled" },
    { id: "rejected", label: "Rejected" },
    { id: "expired", label: "Expired" },
  ];

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
    <div className="space-y-8">
      <header className="pb-6 border-b border-outline-variant/20">
        <span className="text-[10px] tracking-[0.3em] uppercase text-primary font-sans block mb-1">
          Bespoke Commissions
        </span>
        <h1 className="font-serif text-3xl md:text-4xl text-text font-normal">
          Inquiry & Review Queue
        </h1>
        <p className="font-sans text-muted text-xs mt-2">
          Curate custom inquiries, establish honorarium quotes, and monitor collector acquisitions.
        </p>
      </header>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-outline-variant/10 pb-4">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 text-[11px] uppercase tracking-wider transition-colors ${
              filter === tab.id
                ? "bg-primary text-black font-semibold"
                : "bg-surface-highest/5 border border-outline-variant/20 text-muted hover:text-text hover:border-outline-variant/40"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-highest/5 border border-outline-variant/20 p-6 md:p-8">
        {loading ? (
          <div className="py-20 text-center text-muted font-sans text-xs tracking-widest uppercase">
            Loading Queue...
          </div>
        ) : commissions.length === 0 ? (
          <div className="py-20 text-center text-muted font-sans text-xs tracking-widest uppercase">
            No inquiries match &ldquo;{filter}&rdquo;.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Collector</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Budget / Quote</th>
                  <th className="py-3 px-4">Submitted</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-text">
                {commissions.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-highest/10 transition-colors">
                    <td className="py-4 px-4">
                      <div className="font-medium text-text">{c.name}</div>
                      <div className="text-muted text-[11px]">{c.email}</div>
                    </td>
                    <td className="py-4 px-4 text-muted uppercase tracking-wider">{c.size}</td>
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
                        className="px-3.5 py-1.5 border border-outline-variant/30 text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-colors inline-block"
                      >
                        Review &rarr;
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
