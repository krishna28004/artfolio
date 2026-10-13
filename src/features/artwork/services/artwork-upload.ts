import crypto from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import { validReferenceContent } from "@/app/api/media/upload/route";

const BUCKET = "artworks-public";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface UploadedArtworkImages {
  urls: string[];
  thumbnailUrls: string[];
  paths: string[];
}

export async function uploadArtworkImages(
  admin: SupabaseClient<Database>,
  artworkId: string,
  files: File[],
): Promise<UploadedArtworkImages> {
  if (files.length < 1 || files.length > 8) throw new Error("Choose one to eight artwork images.");
  const prepared: { full: Buffer; thumbnail: Buffer }[] = [];
  for (const file of files) {
    const type = file.type.toLowerCase();
    const extension = MIME_EXTENSIONS[type];
    if (!extension || !file.size || file.size > MAX_IMAGE_BYTES) {
      throw new Error("Images must be JPG, PNG, or WebP and at most 12 MB each.");
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!validReferenceContent(bytes, type)) throw new Error("Image content does not match its file type.");
    try {
      const metadata = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
      if (metadata.format !== (extension === "jpg" ? "jpeg" : extension) ||
          !metadata.width || !metadata.height || metadata.width < 64 || metadata.height < 64 ||
          metadata.width > 12000 || metadata.height > 12000) {
        throw new Error("Artwork images must be at least 64 pixels and at most 12,000 pixels in each dimension.");
      }
      const full = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
        .rotate().resize(3000, 3000, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 }).toBuffer();
      const thumbnail = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
        .rotate().resize(480, 480, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 }).toBuffer();
      prepared.push({ full, thumbnail });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Artwork images must")) throw error;
      throw new Error("Could not decode the artwork image.");
    }
  }
  const paths: string[] = [];
  const urls: string[] = [];
  const thumbnailUrls: string[] = [];
  try {
    for (const image of prepared) {
      const base = `artworks/${artworkId}/${crypto.randomUUID()}`;
      const path = `${base}.webp`;
      const thumbPath = `${base}-thumb.webp`;
      const { error } = await admin.storage.from(BUCKET).upload(path, image.full, {
        contentType: "image/webp",
        upsert: false,
      });
      if (error) throw new Error("Artwork storage is unavailable.");
      paths.push(path);
      const { error: thumbError } = await admin.storage.from(BUCKET).upload(thumbPath, image.thumbnail, {
        contentType: "image/webp", upsert: false,
      });
      if (thumbError) throw new Error("Artwork thumbnail storage is unavailable.");
      paths.push(thumbPath);
      urls.push(admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
      thumbnailUrls.push(admin.storage.from(BUCKET).getPublicUrl(thumbPath).data.publicUrl);
    }
    return { paths, urls, thumbnailUrls };
  } catch (error) {
    if (paths.length) {
      const { error: cleanupError } = await admin.storage.from(BUCKET).remove(paths);
      if (cleanupError) console.error("[ARTWORK_UPLOAD_CLEANUP_FAILED]", { artworkId, count: paths.length });
    }
    throw error;
  }
}

export async function removeArtworkImages(admin: SupabaseClient<Database>, paths: string[]) {
  if (!paths.length) return;
  const { error } = await admin.storage.from(BUCKET).remove([...new Set(paths)]);
  if (error) throw new Error("Artwork image cleanup failed.");
}

export function ownedArtworkPaths(urls: string[], artworkId: string): string[] {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!origin) return [];
  const prefix = "/storage/v1/object/public/artworks-public/";
  return urls.flatMap((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== new URL(origin).origin || !parsed.pathname.startsWith(prefix)) return [];
      const path = decodeURIComponent(parsed.pathname.slice(prefix.length));
      if (!path.startsWith(`artworks/${artworkId}/`) || path.includes("..")) return [];
      return path.endsWith(".webp") && !path.endsWith("-thumb.webp")
        ? [path, path.replace(/\.webp$/, "-thumb.webp")]
        : [path];
    } catch { return []; }
  });
}

export function artworkThumbnailUrl(url: string): string {
  try {
    const storageOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const parsed = new URL(url);
    if (!storageOrigin || parsed.origin !== new URL(storageOrigin).origin ||
        !parsed.pathname.startsWith("/storage/v1/object/public/artworks-public/artworks/")) return url;
    return url.endsWith(".webp") && !url.endsWith("-thumb.webp")
      ? url.replace(/\.webp$/, "-thumb.webp") : url;
  } catch { return url; }
}
