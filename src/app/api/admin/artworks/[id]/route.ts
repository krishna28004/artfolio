import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { rupeesToPaise } from "@/shared/utils/money";
import { uploadArtworkImages, removeArtworkImages, ownedArtworkPaths, artworkThumbnailUrl } from "@/features/artwork/services/artwork-upload";
import { artworkInputSchema } from "@/features/artwork/services/artwork-editor-schema";
import { getMuseumSlot } from "@/features/artwork/data/museum-slots";

type Context = { params: Promise<{ id: string }> | { id: string } };
const quickUpdateSchema = z.object({
  publicationStatus: z.enum(["draft", "published", "archived"]).optional(),
  saleStatus: z.enum(["available", "reserved", "sold", "not_for_sale"]).optional(),
  displayOrder: z.number().int().min(0).optional(),
  slotId: z.string().max(50).nullable().optional(),
}).strict();

export async function GET(req: NextRequest, context: Context) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await Promise.resolve(context.params);
  try {
    const { data, error } = await getSupabaseAdmin().from("artworks").select("*").eq("id", id).maybeSingle();
    if (error) return NextResponse.json({ success: false, message: "Could not load artwork." }, { status: 503 });
    if (!data) return NextResponse.json({ success: false, message: "Artwork not found." }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Could not load artwork." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: Context) {
  const auth = await verifyAdminAuth(req, { requireMfa: true });
  if (!auth.authorized) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await Promise.resolve(context.params);
  try {
    const admin = getSupabaseAdmin();
    const { data: current, error: loadError } = await admin.from("artworks").select("*").eq("id", id).maybeSingle();
    if (loadError) return NextResponse.json({ success: false, message: "Could not load artwork." }, { status: 503 });
    if (!current) return NextResponse.json({ success: false, message: "Artwork not found." }, { status: 404 });

    if (!req.headers.get("content-type")?.includes("multipart/form-data")) {
      const parsed = quickUpdateSchema.safeParse(await req.json());
      if (!parsed.success || !Object.keys(parsed.data).length) {
        return NextResponse.json({ success: false, message: "Invalid artwork update." }, { status: 400 });
      }
      const d = parsed.data;
      const slot = getMuseumSlot(d.slotId);
      if (d.slotId && !slot) return NextResponse.json({ success: false, message: "Choose a valid exhibition slot." }, { status: 400 });
      const { data, error } = await admin.from("artworks").update({
        ...(d.publicationStatus && { publication_status: d.publicationStatus }),
        ...(d.publicationStatus && d.publicationStatus !== "published" && { wall_identifier: null, position_3d: null, rotation_3d: null }),
        ...(d.publicationStatus === "archived" && { draft_wall_identifier: null }),
        ...(d.saleStatus && { sale_status: d.saleStatus, is_available: d.saleStatus === "available" }),
        ...(d.displayOrder !== undefined && { display_order: d.displayOrder }),
        ...(d.slotId !== undefined && { draft_wall_identifier: slot?.id || null }),
        updated_at: new Date().toISOString(),
      }).eq("id", id).select().single();
      if (error) return NextResponse.json({ success: false, message: "Could not update artwork." }, { status: 503 });
      return NextResponse.json({ success: true, data });
    }

    const declaredLength = Number(req.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > 50 * 1024 * 1024) {
      return NextResponse.json({ success: false, message: "Upload exceeds the 50 MB request limit." }, { status: 413 });
    }
    const form = await req.formData();
    const raw = form.get("metadata");
    if (typeof raw !== "string") return NextResponse.json({ success: false, message: "Artwork details are required." }, { status: 400 });
    let input: unknown;
    try { input = JSON.parse(raw); } catch {
      return NextResponse.json({ success: false, message: "Artwork details are invalid." }, { status: 400 });
    }
    const parsed = artworkInputSchema.extend({
      existingImageUrls: z.array(z.string().min(1).max(2048)).max(8),
    }).safeParse(input);
    if (!parsed.success) return NextResponse.json({ success: false, message: "Check the artwork details." }, { status: 400 });
    const d = parsed.data;
    const slot = getMuseumSlot(d.slotId);
    if (d.slotId && !slot) return NextResponse.json({ success: false, message: "Choose a valid exhibition slot." }, { status: 400 });
    const currentUrls = current.image_urls.length ? current.image_urls : [current.image_url];
    if (new Set(d.existingImageUrls).size !== d.existingImageUrls.length ||
        d.existingImageUrls.some((url) => !currentUrls.includes(url))) {
      return NextResponse.json({ success: false, message: "Image selection is invalid." }, { status: 400 });
    }
    const files = form.getAll("images");
    if (files.some((file) => !(file instanceof File)) ||
        d.existingImageUrls.length + files.length < 1 ||
        d.existingImageUrls.length + files.length > 8 ||
        d.primaryIndex >= d.existingImageUrls.length + files.length) {
      return NextResponse.json({ success: false, message: "Choose one to eight images and a primary image." }, { status: 400 });
    }
    let uploaded: Awaited<ReturnType<typeof uploadArtworkImages>> = { urls: [], thumbnailUrls: [], paths: [] };
    if (files.length) {
      try { uploaded = await uploadArtworkImages(admin, id, files as File[]); } catch (error) {
        const message = error instanceof Error ? error.message : "Artwork upload failed.";
        return NextResponse.json({ success: false, message }, { status: message.includes("storage") ? 503 : 400 });
      }
    }
    const urls = [...d.existingImageUrls, ...uploaded.urls];
    const { data, error } = await admin.from("artworks").update({
      title: d.title, artist: d.artist, year: d.year,
      description: d.description || null, medium: d.medium || null,
      dimensions: d.dimensions || null, category: d.category || null,
      price: d.priceInRupees === null ? null : rupeesToPaise(d.priceInRupees),
      image_url: urls[d.primaryIndex], image_urls: urls,
      thumbnail_url: d.primaryIndex < d.existingImageUrls.length
        ? artworkThumbnailUrl(urls[d.primaryIndex]) : uploaded.thumbnailUrls[d.primaryIndex - d.existingImageUrls.length],
      publication_status: d.publicationStatus, sale_status: d.saleStatus,
      is_available: d.saleStatus === "available", display_order: d.displayOrder,
      draft_wall_identifier: slot?.id || null,
      ...(d.publicationStatus === "draft" && { wall_identifier: null, position_3d: null, rotation_3d: null }),
      updated_at: new Date().toISOString(),
    }).eq("id", id).select().single();
    if (error || !data) {
      try {
        await removeArtworkImages(admin, uploaded.paths);
        return NextResponse.json({ success: false, message: "Could not save artwork. New images were removed." }, { status: 503 });
      } catch {
        console.error("[ARTWORK_UPDATE_CLEANUP_FAILED]", { id, count: uploaded.paths.length });
        return NextResponse.json({ success: false, message: "Could not save artwork. Image cleanup needs manual review." }, { status: 503 });
      }
    }
    const discarded = currentUrls.filter((url) => !d.existingImageUrls.includes(url));
    try {
      await removeArtworkImages(admin, ownedArtworkPaths(discarded, id));
      return NextResponse.json({ success: true, data });
    } catch {
      console.error("[ARTWORK_DISCARDED_IMAGE_CLEANUP_FAILED]", { id, count: discarded.length });
      return NextResponse.json({ success: true, data, warning: "Artwork saved, but removed images need manual cleanup." });
    }
  } catch {
    return NextResponse.json({ success: false, message: "Artwork could not be updated." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: Context) {
  const auth = await verifyAdminAuth(req, { requireMfa: true });
  if (!auth.authorized) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  const { id } = await Promise.resolve(context.params);
  try {
    const admin = getSupabaseAdmin();
    if (req.nextUrl.searchParams.get("permanent") === "true") {
      const body: unknown = await req.json();
      if (!body || typeof body !== "object" || !("confirmId" in body) || body.confirmId !== id) {
        return NextResponse.json({ success: false, message: "Type the artwork ID to confirm deletion." }, { status: 400 });
      }
      const { data: current, error: readError } = await admin.from("artworks").select("*").eq("id", id).maybeSingle();
      if (readError) return NextResponse.json({ success: false, message: "Could not load artwork." }, { status: 503 });
      if (!current) return NextResponse.json({ success: false, message: "Artwork not found." }, { status: 404 });
      if (current.publication_status !== "draft") {
        return NextResponse.json({ success: false, message: "Only unpublished drafts can be permanently deleted. Archive published work instead." }, { status: 409 });
      }
      const { count, error: referenceError } = await admin.from("commissions")
        .select("id", { count: "exact", head: true }).eq("reference_artwork_id", id);
      if (referenceError || count === null) return NextResponse.json({ success: false, message: "Could not verify artwork references." }, { status: 503 });
      if (count > 0) return NextResponse.json({ success: false, message: "Artwork is linked to a commission and cannot be deleted." }, { status: 409 });
      const { error: deleteError } = await admin.from("artworks").delete().eq("id", id);
      if (deleteError) return NextResponse.json({ success: false, message: "Could not delete artwork." }, { status: 503 });
      try {
        await removeArtworkImages(admin, ownedArtworkPaths(current.image_urls.length ? current.image_urls : [current.image_url], id));
        return NextResponse.json({ success: true, message: "Draft artwork deleted." });
      } catch {
        console.error("[ARTWORK_DELETE_CLEANUP_FAILED]", { id });
        return NextResponse.json({ success: true, message: "Draft deleted, but its image cleanup needs manual review." });
      }
    }
    const { data, error } = await admin.from("artworks")
      .update({ publication_status: "archived", wall_identifier: null, draft_wall_identifier: null, position_3d: null,
        rotation_3d: null, updated_at: new Date().toISOString() })
      .eq("id", id).select().maybeSingle();
    if (error) return NextResponse.json({ success: false, message: "Could not archive artwork." }, { status: 503 });
    if (!data) return NextResponse.json({ success: false, message: "Artwork not found." }, { status: 404 });
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Artwork could not be archived." }, { status: 500 });
  }
}
