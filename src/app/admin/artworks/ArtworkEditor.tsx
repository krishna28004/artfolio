"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MUSEUM_SLOTS } from "@/features/artwork/data/museum-slots";

export interface ArtworkAdminItem {
  id: string;
  title: string;
  artist: string;
  year: number;
  description: string | null;
  medium: string | null;
  dimensions: string | null;
  category: string | null;
  price: number | null;
  image_url: string;
  image_urls: string[];
  display_order: number;
  publication_status: "draft" | "published" | "archived";
  sale_status: "available" | "reserved" | "sold" | "not_for_sale";
  wall_identifier: string | null;
  draft_wall_identifier: string | null;
  position_3d: number[] | null;
  rotation_3d: number[] | null;
}

interface NewImage { file: File; url: string; width: number; height: number }
interface ArtworkEditorProps {
  artwork: ArtworkAdminItem | null;
  artworks: ArtworkAdminItem[];
  onSaved: (warning?: string) => void;
  onCancel: () => void;
}

export function ArtworkEditor({ artwork, artworks, onSaved, onCancel }: ArtworkEditorProps) {
  const [title, setTitle] = useState(artwork?.title || "");
  const [artist, setArtist] = useState(artwork?.artist || "Krishna Kumar");
  const [year, setYear] = useState(artwork?.year || new Date().getFullYear());
  const [description, setDescription] = useState(artwork?.description || "");
  const [category, setCategory] = useState(artwork?.category || "");
  const [medium, setMedium] = useState(artwork?.medium || "");
  const [dimensions, setDimensions] = useState(artwork?.dimensions || "");
  const [price, setPrice] = useState<number | null>(artwork?.price === null || artwork?.price === undefined ? null : artwork.price / 100);
  const [publicationStatus, setPublicationStatus] = useState<"draft" | "published">(artwork?.publication_status === "published" ? "published" : "draft");
  const [saleStatus, setSaleStatus] = useState<ArtworkAdminItem["sale_status"]>(artwork?.sale_status || "available");
  const [displayOrder, setDisplayOrder] = useState(artwork?.display_order || 0);
  const [slotId, setSlotId] = useState(artwork?.draft_wall_identifier && MUSEUM_SLOTS.some((slot) => slot.id === artwork.draft_wall_identifier) ? artwork.draft_wall_identifier : "");
  const [existingImages, setExistingImages] = useState<string[]>(artwork ? artwork.image_urls?.length ? artwork.image_urls : [artwork.image_url] : []);
  const [newImages, setNewImages] = useState<NewImage[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(() => artwork ? Math.max(0, (artwork.image_urls?.length ? artwork.image_urls : [artwork.image_url]).indexOf(artwork.image_url)) : 0);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const previewUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = previewUrls.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); };
  }, []);

  async function addFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList);
    if (existingImages.length + newImages.length + files.length > 8) {
      setError("Choose at most eight images.");
      return;
    }
    const next: NewImage[] = [];
    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 12 * 1024 * 1024) {
        setError("Images must be JPG, PNG, or WebP and at most 12 MB each.");
        for (const image of next) { URL.revokeObjectURL(image.url); previewUrls.current.delete(image.url); }
        return;
      }
      try {
        const bitmap = await createImageBitmap(file);
        const url = URL.createObjectURL(file);
        previewUrls.current.add(url);
        next.push({ file, url, width: bitmap.width, height: bitmap.height });
        bitmap.close();
      } catch {
        setError(`Could not read ${file.name}. Choose another image.`);
        for (const image of next) { URL.revokeObjectURL(image.url); previewUrls.current.delete(image.url); }
        return;
      }
    }
    setNewImages((current) => [...current, ...next]);
    setError("");
  }

  function removeImage(index: number) {
    if (index < existingImages.length) {
      setExistingImages((current) => current.filter((_, position) => position !== index));
    } else {
      const image = newImages[index - existingImages.length];
      if (image) { URL.revokeObjectURL(image.url); previewUrls.current.delete(image.url); }
      setNewImages((current) => current.filter((_, position) => position !== index - existingImages.length));
    }
    setPrimaryIndex((current) => current === index ? 0 : current > index ? current - 1 : current);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (existingImages.length + newImages.length < 1) { setError("Add at least one artwork image."); return; }
    setSaving(true);
    setProgress(null);
    const metadata = {
      title, artist, year, description, category, medium, dimensions,
      priceInRupees: price, publicationStatus, saleStatus, displayOrder,
      primaryIndex, existingImageUrls: existingImages,
      slotId: slotId || null,
    };
    const body = new FormData();
    body.append("metadata", JSON.stringify(metadata));
    for (const image of newImages) body.append("images", image.file);
    try {
      const result = await new Promise<{ success: boolean; message?: string; warning?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open(artwork ? "PATCH" : "POST", artwork ? `/api/admin/artworks/${encodeURIComponent(artwork.id)}` : "/api/admin/artworks");
        xhr.upload.onprogress = (upload) => {
          if (upload.lengthComputable) setProgress(Math.round((upload.loaded / upload.total) * 100));
        };
        xhr.onerror = () => reject(new Error("Upload failed. Check your connection and retry."));
        xhr.onload = () => {
          let response: { success: boolean; message?: string; warning?: string };
          try { response = JSON.parse(xhr.responseText); } catch { reject(new Error("The server returned an invalid response.")); return; }
          if (xhr.status >= 200 && xhr.status < 300 && response.success) resolve(response);
          else reject(new Error(response.message || "Could not save artwork."));
        };
        xhr.send(body);
      });
      if (result.success) onSaved(result.warning);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save artwork.");
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  const allImages = [...existingImages.map((url) => ({ url, label: "Existing image" })),
    ...newImages.map((image) => ({ url: image.url, label: `${image.width} × ${image.height} px` }))];
  const inputClass = "w-full bg-surface-lowest border border-outline-variant/30 px-3 py-2 text-text focus:outline-none focus:border-primary";
  const labelClass = "block text-xs uppercase tracking-wider text-muted space-y-2";

  return (
    <form onSubmit={(event) => void save(event)} className="space-y-6 border border-outline-variant/30 bg-surface-highest/5 p-5 md:p-8" aria-label={artwork ? `Edit ${artwork.title}` : "Add artwork"}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-serif text-2xl text-text">{artwork ? "Edit Artwork" : "Add Artwork"}</h2>
        <button type="button" onClick={onCancel} className="text-xs text-muted underline hover:text-text">Cancel</button>
      </div>
      <label className={labelClass}>Artwork images (JPG, PNG, WebP; up to 8)
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => { void addFiles(event.target.files); event.target.value = ""; }} className={inputClass} />
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {allImages.map((image, index) => (
          <div key={`${image.url}-${index}`} className="space-y-2 border border-outline-variant/20 p-2">
            <div className="relative aspect-square bg-black/30"><Image src={image.url} alt={`${title || "Artwork"} image ${index + 1}`} fill unoptimized className="object-contain" /></div>
            <p className="text-[11px] text-muted">{image.label}</p>
            <label className="flex items-center gap-2 text-xs text-text"><input type="radio" name="primaryImage" checked={primaryIndex === index} onChange={() => setPrimaryIndex(index)} /> Primary</label>
            <button type="button" onClick={() => removeImage(index)} className="text-xs text-red-300 underline">Remove</button>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className={labelClass}>Title<input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Artist<input required maxLength={200} value={artist} onChange={(event) => setArtist(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Year<input required type="number" min="1900" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} className={inputClass} /></label>
        <label className={labelClass}>Category<input maxLength={100} value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Medium<input maxLength={200} value={medium} onChange={(event) => setMedium(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Dimensions<input maxLength={100} value={dimensions} onChange={(event) => setDimensions(event.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Price (INR; optional)<input type="number" min="1" step="1" value={price ?? ""} onChange={(event) => setPrice(event.target.value ? Number(event.target.value) : null)} className={inputClass} /></label>
        <label className={labelClass}>Sale status<select value={saleStatus} onChange={(event) => setSaleStatus(event.target.value as ArtworkAdminItem["sale_status"])} className={inputClass}><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="not_for_sale">Not for sale</option></select></label>
        <label className={labelClass}>Publication<select value={publicationStatus} onChange={(event) => setPublicationStatus(event.target.value as "draft" | "published")} className={inputClass}><option value="draft">Draft</option><option value="published">Published</option></select></label>
        <label className={labelClass}>Display order<input type="number" min="0" value={displayOrder} onChange={(event) => setDisplayOrder(Number(event.target.value))} className={inputClass} /></label>
        <label className={labelClass}>Exhibition wall slot<select value={slotId} onChange={(event) => setSlotId(event.target.value)} className={inputClass}>
          <option value="">Unassigned</option>
          {MUSEUM_SLOTS.map((slot) => {
            const occupant = artworks.find((item) => item.id !== artwork?.id && item.publication_status !== "archived" && item.draft_wall_identifier === slot.id);
            return <option key={slot.id} value={slot.id} disabled={!!occupant}>{slot.label}{occupant ? ` · occupied by ${occupant.title}` : ""}</option>;
          })}
        </select></label>
      </div>
      <label className={labelClass}>Description<textarea maxLength={2000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /></label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {saving && <p role="status" className="text-sm text-muted">{progress === null ? "Saving artwork…" : `Uploading images… ${progress}%`}</p>}
      <button type="submit" disabled={saving} className="bg-primary px-6 py-3 text-xs font-semibold uppercase tracking-widest text-black disabled:opacity-50">{saving ? "Saving…" : publicationStatus === "published" ? "Publish artwork" : "Save draft"}</button>
    </form>
  );
}
