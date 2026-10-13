import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { artworkInputSchema } from "@/features/artwork/services/artwork-editor-schema";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { rupeesToPaise } from "@/shared/utils/money";
import { removeArtworkImages, uploadArtworkImages } from "@/features/artwork/services/artwork-upload";
import { getMuseumSlot } from "@/features/artwork/data/museum-slots";
import { mapDbArtworkToDomain } from "@/features/artwork/services/artwork-service";

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }
    if (req.nextUrl.searchParams.get("view") === "exhibition-settings") {
      const { data, error } = await getSupabaseAdmin().from("exhibition_settings")
        .select("is_published, updated_at").eq("id", "main").maybeSingle();
      if (error || !data) return NextResponse.json({ success: false, message: "Exhibition settings are unavailable." }, { status: 503 });
      return NextResponse.json({ success: true, data });
    }
    const { data, error } = await getSupabaseAdmin()
      .from("artworks").select("*").order("display_order", { ascending: true });
    if (error) return NextResponse.json({ success: false, message: "Could not load artworks." }, { status: 503 });
    if (req.nextUrl.searchParams.get("view") === "exhibition-preview") {
      const draftArtworks = (data || [])
        .filter((art) => art.publication_status !== "archived" && !!getMuseumSlot(art.draft_wall_identifier))
        .map((art) => mapDbArtworkToDomain({ ...art,
          wall_identifier: art.draft_wall_identifier, position_3d: null, rotation_3d: null }));
      return NextResponse.json({ success: true, count: draftArtworks.length, data: draftArtworks });
    }
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await verifyAdminAuth(req, { requireMfa: true });
  if (!authResult.authorized) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }
  if (req.headers.get("content-type")?.includes("application/json")) {
    try {
      const action = (await req.json())?.action;
      if (action !== "publish_exhibition" && action !== "unpublish_exhibition") {
        return NextResponse.json({ success: false, message: "Unknown exhibition action." }, { status: 400 });
      }
      const { data, error } = await getSupabaseAdmin().rpc("set_exhibition_publication", {
        p_publish: action === "publish_exhibition", p_actor: authResult.userEmail || "owner",
      });
      if (error) return NextResponse.json({ success: false, message: "Exhibition could not be updated. Check for occupied or invalid slots." }, { status: 409 });
      return NextResponse.json({ success: true, data: { is_published: data } });
    } catch {
      return NextResponse.json({ success: false, message: "Exhibition could not be updated." }, { status: 500 });
    }
  }
  const declaredLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > 50 * 1024 * 1024) {
    return NextResponse.json({ success: false, message: "Upload exceeds the 50 MB request limit." }, { status: 413 });
  }
  try {
    const form = await req.formData();
    const metadata = form.get("metadata");
    if (typeof metadata !== "string") {
      return NextResponse.json({ success: false, message: "Artwork details are required." }, { status: 400 });
    }
    let input: unknown;
    try { input = JSON.parse(metadata); } catch {
      return NextResponse.json({ success: false, message: "Artwork details are invalid." }, { status: 400 });
    }
    const parsed = artworkInputSchema.safeParse(input);
    if (!parsed.success) {
      return NextResponse.json({ success: false, message: "Check the artwork details." }, { status: 400 });
    }
    const files = form.getAll("images");
    if (files.length < 1 || files.length > 8 || files.some((file) => !(file instanceof File))) {
      return NextResponse.json({ success: false, message: "Choose one to eight artwork images." }, { status: 400 });
    }
    const d = parsed.data;
    const slot = getMuseumSlot(d.slotId);
    if (d.slotId && !slot) {
      return NextResponse.json({ success: false, message: "Choose a valid exhibition slot." }, { status: 400 });
    }
    if (d.primaryIndex >= files.length) {
      return NextResponse.json({ success: false, message: "Choose a primary image." }, { status: 400 });
    }
    const slug = d.title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "artwork";
    const id = `${slug}-${crypto.randomUUID().slice(0, 8)}`;
    const admin = getSupabaseAdmin();
    let uploaded;
    try {
      uploaded = await uploadArtworkImages(admin, id, files as File[]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Artwork upload failed.";
      return NextResponse.json({ success: false, message }, { status: message.includes("storage") ? 503 : 400 });
    }
    const { data, error } = await admin.from("artworks").insert({
      id, title: d.title, artist: d.artist, year: d.year,
      description: d.description || null, medium: d.medium || null,
      dimensions: d.dimensions || null, category: d.category || null,
      price: d.priceInRupees === null ? null : rupeesToPaise(d.priceInRupees),
      image_url: uploaded.urls[d.primaryIndex], image_urls: uploaded.urls,
      thumbnail_url: uploaded.thumbnailUrls[d.primaryIndex],
      publication_status: d.publicationStatus, sale_status: d.saleStatus,
      is_available: d.saleStatus === "available", display_order: d.displayOrder,
      draft_wall_identifier: slot?.id || null,
      wall_identifier: null, position_3d: null, rotation_3d: null,
    }).select().single();
    if (error || !data) {
      try {
        await removeArtworkImages(admin, uploaded.paths);
        return NextResponse.json({ success: false, message: "Could not save artwork. Uploaded images were removed." }, { status: 503 });
      } catch {
        console.error("[ARTWORK_CREATE_CLEANUP_FAILED]", { id, count: uploaded.paths.length });
        return NextResponse.json({ success: false, message: "Could not save artwork. Image cleanup needs manual review." }, { status: 503 });
      }
    }
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, message: "Artwork could not be created." }, { status: 500 });
  }
}
