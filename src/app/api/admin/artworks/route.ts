import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { rupeesToPaise } from "@/shared/utils/money";

const artworkInputSchema = z.object({
  id: z.string().min(2).max(100),
  title: z.string().min(1).max(200),
  artist: z.string().default("Krishna Kumar"),
  year: z.number().int().min(1900).max(2100).default(2024),
  description: z.string().max(2000).optional(),
  medium: z.string().max(200).optional(),
  dimensions: z.string().max(100).optional(),
  priceInRupees: z.number().int().positive().optional(),
  category: z.string().max(100).optional(),
  imageUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  textureUrl: z.string().url().optional(),
  position3D: z.array(z.number()).length(3).optional(),
  rotation3D: z.array(z.number()).length(3).optional(),
  wallIdentifier: z.string().max(50).optional(),
  displayOrder: z.number().int().default(0),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export async function GET(req: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("artworks")
      .select("*")
      .order("display_order", { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const body = await req.json();
    const parseResult = artworkInputSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, message: "Invalid payload.", errors: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const d = parseResult.data;
    const pricePaise = d.priceInRupees ? rupeesToPaise(d.priceInRupees) : null;
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("artworks")
      .upsert({
        id: d.id,
        title: d.title,
        artist: d.artist,
        year: d.year,
        description: d.description || null,
        medium: d.medium || null,
        dimensions: d.dimensions || null,
        price: pricePaise,
        category: d.category || null,
        image_url: d.imageUrl,
        thumbnail_url: d.thumbnailUrl || null,
        texture_url: d.textureUrl || null,
        position_3d: d.position3D || null,
        rotation_3d: d.rotation3D || null,
        wall_identifier: d.wallIdentifier || null,
        display_order: d.displayOrder,
        is_available: d.isAvailable,
        is_featured: d.isFeatured,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor: authResult.userEmail || "admin",
      action: "artwork_upserted",
      target_type: "artwork",
      target_id: d.id,
      metadata: { title: d.title, pricePaise },
    });

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
