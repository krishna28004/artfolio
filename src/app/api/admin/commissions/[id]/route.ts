import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { verifyAdminAuth } from "@/features/admin/utils/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authResult = await verifyAdminAuth(req);
    if (!authResult.authorized) {
      const legacyKey = process.env.ADMIN_API_KEY;
      const authHeader = req.headers.get("authorization") || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      if (!legacyKey || bearerToken !== legacyKey) {
        return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
      }
    }

    const params = await Promise.resolve(context.params);
    const commissionId = params.id;

    const supabaseAdmin = getSupabaseAdmin();
    const { data: commission, error } = await supabaseAdmin
      .from("commissions")
      .select("*, payments(*)")
      .eq("id", commissionId)
      .single();

    if (error || !commission) {
      return NextResponse.json({ success: false, message: "Commission not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: commission });
  } catch (error) {
    console.error("[ADMIN_COMMISSION_DETAIL_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
