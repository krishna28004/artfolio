import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { rupeesToPaise } from "@/shared/utils/money";
import type { Database, Json } from "@/types/supabase";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("artworks")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, message: "Artwork not found." }, { status: 404 });
    }

    if (req.method !== "GET") { revalidatePath("/"); revalidatePath("/artwork/" + params.id); revalidatePath("/exhibition/accessible"); }
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}


export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const parsed = z.object({
      title: z.string().trim().min(1).max(200).optional(), description: z.string().max(2000).optional(),
      medium: z.string().max(200).optional(), dimensions: z.string().max(100).optional(),
      isAvailable: z.boolean().optional(), isFeatured: z.boolean().optional(),
      displayOrder: z.number().int().min(0).optional(), priceInRupees: z.number().int().positive().max(10000000).nullable().optional(),
      publicationStatus: z.enum(["draft","published","archived"]).optional(),
    }).strict().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid artwork update." }, { status: 400 });
    const body = parsed.data;
    const supabaseAdmin = getSupabaseAdmin();

    const updatePayload: Database["public"]["Tables"]["artworks"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if (body.publicationStatus) updatePayload.publication_status = body.publicationStatus;
    if (typeof body.title === "string") updatePayload.title = body.title;
    if (typeof body.description === "string") updatePayload.description = body.description;
    if (typeof body.medium === "string") updatePayload.medium = body.medium;
    if (typeof body.dimensions === "string") updatePayload.dimensions = body.dimensions;
    if (typeof body.isAvailable === "boolean") { updatePayload.is_available = body.isAvailable; updatePayload.sale_status = body.isAvailable ? "available" : "not_for_sale"; }
    if (typeof body.isFeatured === "boolean") updatePayload.is_featured = body.isFeatured;
    if (typeof body.displayOrder === "number") updatePayload.display_order = body.displayOrder;
    if (body.priceInRupees !== undefined) {
      updatePayload.price = body.priceInRupees ? rupeesToPaise(Number(body.priceInRupees)) : null;
    }

    const { data, error } = await supabaseAdmin
      .from("artworks")
      .update(updatePayload)
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: "Artwork update could not be saved." }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor: authResult.userEmail || "admin",
      action: "artwork_updated",
      target_type: "artwork",
      target_id: params.id,
      metadata: updatePayload as unknown as Json,
    });

    if (req.method !== "GET") { revalidatePath("/"); revalidatePath("/artwork/" + params.id); revalidatePath("/exhibition/accessible"); }
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}

/**
 * Safe Archival: marks artwork as unavailable rather than hard-deleting.
 */
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("artworks")
      .update({
        is_available: false,
        publication_status: "archived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: "Artwork update could not be saved." }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor: authResult.userEmail || "admin",
      action: "artwork_archived",
      target_type: "artwork",
      target_id: params.id,
      metadata: { archived: true },
    });

    revalidatePath("/"); revalidatePath("/artwork/" + params.id); revalidatePath("/exhibition/accessible");
    return NextResponse.json({ success: true, message: "Artwork archived successfully.", data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
