import { NextRequest, NextResponse } from "next/server";
import { authorizeCustomer } from "@/features/commission/server/customer-access";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { checkDistributedRateLimit, getClientIp } from "@/shared/utils/rate-limit";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ message: "File unavailable." }, { status: 404 });
  const limit = await checkDistributedRateLimit(`commission_file_${getClientIp(req)}`, 50, 60 * 60 * 1000);
  if (!limit.success) return NextResponse.json({ message: "Too many downloads." }, { status: 429 });
  const admin = getSupabaseAdmin();
  const { data: file } = await admin.from("commission_files")
    .select("id, commission_id, kind, storage_path, delivered_at").eq("id", id).maybeSingle();
  if (!file?.commission_id) return NextResponse.json({ message: "File unavailable." }, { status: 404 });
  const adminAccess = (await verifyAdminAuth(req)).authorized;
  if (!adminAccess) {
    const requestedCommission = req.nextUrl.searchParams.get("commissionId");
    if (requestedCommission !== file.commission_id || !(await authorizeCustomer(req, file.commission_id))) {
      return NextResponse.json({ message: "File unavailable." }, { status: 403 });
    }
    if (file.kind === "deliverable") {
      if (!file.delivered_at) return NextResponse.json({ message: "Delivery is not available yet." }, { status: 403 });
      const { data: commission } = await admin.from("commissions")
        .select("status").eq("id", file.commission_id).maybeSingle();
      if (!commission || !["delivered", "completed", "fulfilled", "revision_requested"].includes(commission.status)) {
        return NextResponse.json({ message: "Delivery is not available yet." }, { status: 403 });
      }
    }
  }
  const safePath = file.kind === "reference"
    ? new RegExp("^staging/" + file.id + "\\.(jpg|png|webp|pdf)$", "i").test(file.storage_path)
    : new RegExp("^deliveries/" + file.commission_id + "/" + file.id + "\\.(jpg|png|webp|pdf)$", "i").test(file.storage_path);
  if (!safePath || file.storage_path.includes("..")) return NextResponse.json({ message: "File unavailable." }, { status: 404 });
  const { data, error } = await admin.storage.from("commission-private").createSignedUrl(file.storage_path, 60);
  if (error || !data?.signedUrl) return NextResponse.json({ message: "File temporarily unavailable." }, { status: 503 });
  await admin.from("commission_files").update({ accessed_at: new Date().toISOString() }).eq("id", id);
  const response = NextResponse.redirect(data.signedUrl);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
