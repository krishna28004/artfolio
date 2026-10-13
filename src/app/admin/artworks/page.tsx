"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatRupees } from "@/shared/utils/money";

interface ArtworkAdminItem {
  id: string;
  title: string;
  artist: string;
  year: number;
  medium: string | null;
  dimensions: string | null;
  price: number | null;
  image_url: string;
  display_order: number;
  is_available: boolean;
  wall_identifier: string | null;
}

export default function AdminArtworksPage() {
  const [artworks, setArtworks] = useState<ArtworkAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const fetchArtworks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/artworks");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setArtworks(data.data);
        }
      }
    } catch (err) {
      console.warn("[ADMIN_ARTWORKS_FETCH_ERROR]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!ignore) {
        await fetchArtworks();
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchArtworks]);

  const toggleAvailability = async (art: ArtworkAdminItem) => {
    setActionId(art.id);
    try {
      const res = await fetch(`/api/admin/artworks/${art.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable: !art.is_available }),
      });
      if (res.ok) {
        await fetchArtworks();
      }
    } catch (err) {
      console.error("[TOGGLE_AVAILABILITY_ERROR]", err);
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-outline-variant/20">
        <div>
          <span className="text-[10px] tracking-[0.3em] uppercase text-primary font-sans block mb-1">
            Permanent Exhibition
          </span>
          <h1 className="font-serif text-3xl md:text-4xl text-text font-normal">
            Artwork Catalog Management
          </h1>
          <p className="font-sans text-muted text-xs mt-2">
            Control online catalog visibility, curatorial metadata, and 3D exhibition placement.
          </p>
        </div>
      </header>

      <div className="bg-surface-highest/5 border border-outline-variant/20 p-6 md:p-8">
        {loading ? (
          <div className="py-20 text-center text-muted font-sans text-xs tracking-widest uppercase">
            Loading Catalog Records...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans text-xs border-collapse">
              <thead>
                <tr className="border-b border-outline-variant/20 text-muted uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Exhibit</th>
                  <th className="py-3 px-4">Medium & Dimensions</th>
                  <th className="py-3 px-4">Price (Paise / INR)</th>
                  <th className="py-3 px-4">3D Wall</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 text-text">
                {artworks.map((art) => (
                  <tr key={art.id} className="hover:bg-surface-highest/10 transition-colors">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-14 bg-surface-lowest border border-outline-variant/20 flex-shrink-0 overflow-hidden">
                          <Image
                            src={art.image_url}
                            alt={art.title}
                            width={48}
                            height={56}
                            unoptimized
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-serif text-sm text-text font-normal">{art.title}</div>
                          <div className="text-muted text-[10px] uppercase tracking-wider">{art.year} &bull; {art.artist}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-muted">
                      <div>{art.medium || "Pencil on Paper"}</div>
                      <div className="text-[10px] text-muted/70">{art.dimensions || "A3 Sheet"}</div>
                    </td>
                    <td className="py-4 px-4 font-mono text-[11px]">
                      {art.price ? formatRupees(art.price) : "Inquire"}
                    </td>
                    <td className="py-4 px-4 text-muted uppercase text-[10px] tracking-wider">
                      {art.wall_identifier || "Gallery Floor"}
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 text-[10px] uppercase tracking-widest border ${
                          art.is_available
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-600/30"
                            : "bg-neutral-900 text-neutral-400 border-neutral-700/30"
                        }`}
                      >
                        {art.is_available ? "Active" : "Archived"}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => toggleAvailability(art)}
                        disabled={actionId === art.id}
                        className="px-3 py-1.5 border border-outline-variant/30 text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {actionId === art.id
                          ? "..."
                          : art.is_available
                          ? "Archive"
                          : "Restore"}
                      </button>
                      <Link
                        href={`/artwork/${art.id}`}
                        target="_blank"
                        className="px-3 py-1.5 border border-outline-variant/20 text-[10px] uppercase tracking-widest text-muted hover:text-text transition-colors inline-block"
                      >
                        View &nearr;
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
