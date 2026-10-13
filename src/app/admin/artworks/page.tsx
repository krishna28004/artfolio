"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatRupees } from "@/shared/utils/money";
import { ArtworkEditor, type ArtworkAdminItem } from "./ArtworkEditor";

export default function AdminArtworksPage() {
  const [artworks, setArtworks] = useState<ArtworkAdminItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [editor, setEditor] = useState<ArtworkAdminItem | "new" | null>(null);
  const [error, setError] = useState("");
  const [exhibitionPublished, setExhibitionPublished] = useState<boolean | null>(null);
  const [exhibitionAction, setExhibitionAction] = useState(false);

  const fetchExhibition = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/artworks?view=exhibition-settings");
      const body = await res.json();
      if (res.ok && body.success && typeof body.data?.is_published === "boolean") {
        setExhibitionPublished(body.data.is_published);
      } else setError("Could not load exhibition publication state.");
    } catch { setError("Could not load exhibition publication state."); }
  }, []);

  const fetchArtworks = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/artworks");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setArtworks(data.data);
          setError("");
        } else {
          setError("Could not load the artwork catalog. Retry to refresh it.");
        }
      } else {
        setError("Could not load the artwork catalog. Retry to refresh it.");
      }
    } catch (err) {
      console.warn("[ADMIN_ARTWORKS_FETCH_ERROR]", err);
      setError("Could not load the artwork catalog. Retry to refresh it.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      if (!ignore) {
        await Promise.all([fetchArtworks(), fetchExhibition()]);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [fetchArtworks, fetchExhibition]);

  const setExhibitionPublication = async (publish: boolean) => {
    const description = publish ? "Publish the current draft wall placements to the public exhibition?" : "Hide the public exhibition until you publish it again?";
    if (!window.confirm(description)) return;
    setExhibitionAction(true);
    try {
      const res = await fetch("/api/admin/artworks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: publish ? "publish_exhibition" : "unpublish_exhibition" }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) setError(body.message || "Could not update exhibition.");
      else { await Promise.all([fetchArtworks(), fetchExhibition()]); setError(""); }
    } catch { setError("Could not update exhibition. Please retry."); }
    finally { setExhibitionAction(false); }
  };

  const toggleArchive = async (art: ArtworkAdminItem) => {
    setActionId(art.id);
    try {
      const res = await fetch(`/api/admin/artworks/${art.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicationStatus: art.publication_status === "archived" ? "draft" : "archived" }),
      });
      if (res.ok) {
        await fetchArtworks();
      } else {
        setError("Could not change publication status. Please retry.");
      }
    } catch (err) {
      console.error("[TOGGLE_AVAILABILITY_ERROR]", err);
      setError("Could not change publication status. Please retry.");
    } finally {
      setActionId(null);
    }
  };

  const deleteDraft = async (art: ArtworkAdminItem) => {
    const confirmation = window.prompt(`Permanently delete this draft and its uploaded images? Type ${art.id} to confirm.`);
    if (confirmation !== art.id) return;
    setActionId(art.id);
    try {
      const res = await fetch(`/api/admin/artworks/${encodeURIComponent(art.id)}?permanent=true`, {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmId: art.id }),
      });
      if (res.ok) await fetchArtworks();
      else setError((await res.json()).message || "Could not delete draft artwork.");
    } catch {
      setError("Could not delete draft artwork. Please retry.");
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
        <button type="button" onClick={() => setEditor("new")} className="bg-primary text-black px-5 py-2.5 text-xs font-semibold uppercase tracking-widest hover:bg-white">Add Artwork</button>
      </header>

      {editor && <ArtworkEditor key={editor === "new" ? "new" : editor.id} artwork={editor === "new" ? null : editor} artworks={artworks} onCancel={() => setEditor(null)} onSaved={(warning) => { setEditor(null); void fetchArtworks().then(() => { if (warning) setError(warning); }); }} />}
      {error && <div role="alert" className="flex items-center gap-3 text-sm text-red-300"><span>{error}</span><button type="button" onClick={() => void fetchArtworks()} className="underline">Retry</button></div>}

      <section className="border border-outline-variant/20 bg-surface-highest/5 p-5 md:p-6 space-y-3" aria-label="Exhibition curator">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-serif text-xl text-text">Virtual Exhibition</h2>
            <p className="text-xs text-muted">{exhibitionPublished === null ? "Loading publication state…" : exhibitionPublished ? "Public exhibition is live." : "Public exhibition is hidden."} Wall changes stay in draft until you publish them.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/exhibition?preview=draft" target="_blank" className="border border-outline-variant/30 px-4 py-2 text-xs uppercase tracking-wider text-text hover:border-primary">Preview draft</Link>
            <button type="button" disabled={exhibitionAction || exhibitionPublished === null} onClick={() => void setExhibitionPublication(true)} className="bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wider text-black disabled:opacity-50">{exhibitionAction ? "Working…" : exhibitionPublished ? "Publish wall changes" : "Publish exhibition"}</button>
            {exhibitionPublished && <button type="button" disabled={exhibitionAction} onClick={() => void setExhibitionPublication(false)} className="border border-red-500/30 px-4 py-2 text-xs uppercase tracking-wider text-red-300 disabled:opacity-50">Unpublish</button>}
          </div>
        </div>
      </section>

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
                  <th className="py-3 px-4">Price (INR)</th>
                  <th className="py-3 px-4">3D Wall</th>
                  <th className="py-3 px-4">Publication / Sale</th>
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
                      <div>Live: {art.wall_identifier || "Unassigned"}</div>
                      <div className="text-[10px] text-primary">Draft: {art.draft_wall_identifier || "Unassigned"}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 text-[10px] uppercase tracking-widest border ${
                          art.publication_status === "published"
                            ? "bg-emerald-950/40 text-emerald-400 border-emerald-600/30"
                            : "bg-neutral-900 text-neutral-400 border-neutral-700/30"
                        }`}
                      >
                        {art.publication_status} / {art.sale_status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right space-x-2">
                      <button
                        onClick={() => void toggleArchive(art)}
                        disabled={actionId === art.id}
                        className="px-3 py-1.5 border border-outline-variant/30 text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                      >
                        {actionId === art.id
                          ? "..."
                          : art.publication_status !== "archived"
                          ? "Archive"
                          : "Restore"}
                      </button>
                      <button type="button" onClick={() => setEditor(art)} className="px-3 py-1.5 border border-outline-variant/30 text-[10px] uppercase tracking-widest hover:border-primary hover:text-primary transition-colors">Edit</button>
                      {art.publication_status === "draft" && <button type="button" onClick={() => void deleteDraft(art)} disabled={actionId === art.id} className="px-3 py-1.5 border border-red-500/30 text-[10px] uppercase tracking-widest text-red-300 disabled:opacity-50">Delete draft</button>}
                      {art.publication_status === "published" && <Link
                        href={`/artwork/${art.id}`}
                        target="_blank"
                        className="px-3 py-1.5 border border-outline-variant/20 text-[10px] uppercase tracking-widest text-muted hover:text-text transition-colors inline-block"
                      >
                        View &nearr;
                      </Link>}
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
