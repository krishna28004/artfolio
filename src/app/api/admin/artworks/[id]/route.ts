import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { rupeesToPaise } from "@/shared/utils/money";
import { Database, Json } from "@/types/supabase";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
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

    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}


export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
    }

    const params = await Promise.resolve(context.params);
    const body = await req.json();
    const supabaseAdmin = getSupabaseAdmin();

    const updatePayload: Database["public"]["Tables"]["artworks"]["Update"] = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.title === "string") updatePayload.title = body.title;
    if (typeof body.description === "string") updatePayload.description = body.description;
    if (typeof body.medium === "string") updatePayload.medium = body.medium;
    if (typeof body.dimensions === "string") updatePayload.dimensions = body.dimensions;
    if (typeof body.isAvailable === "boolean") updatePayload.is_available = body.isAvailable;
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
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor: authResult.userEmail || "admin",
      action: "artwork_updated",
      target_type: "artwork",
      target_id: params.id,
      metadata: updatePayload as unknown as Json,
    });

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
  context: { params: Promise<{ id: string }> | { id: string } }
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
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor: authResult.userEmail || "admin",
      action: "artwork_archived",
      target_type: "artwork",
      target_id: params.id,
      metadata: { archived: true },
    });

    return NextResponse.json({ success: true, message: "Artwork archived successfully.", data });
  } catch {
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
