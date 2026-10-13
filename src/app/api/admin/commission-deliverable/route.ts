import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { validReferenceContent } from "@/app/api/media/upload/route";

const LIMIT = 25 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req, { requireMfa: true });
  if (!auth.authorized) return NextResponse.json({ success: false, message: "Owner access required." }, { status: 401 });
  const form = await req.formData();
  const id = form.get("commissionId");
  const file = form.get("file");
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || !(file instanceof File)) {
    return NextResponse.json({ success: false, message: "Invalid deliverable." }, { status: 400 });
  }
  if (file.size === 0 || file.size > LIMIT || !EXTENSIONS[file.type.toLowerCase()]) {
    return NextResponse.json({ success: false, message: "Use a JPG, PNG, WebP, or PDF under 25 MB." }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!validReferenceContent(bytes, file.type.toLowerCase())) {
    return NextResponse.json({ success: false, message: "File content does not match its type." }, { status: 400 });
  }
  const admin = getSupabaseAdmin();
  const { data: commission } = await admin.from("commissions").select("status").eq("id", id).maybeSingle();
  if (!commission || !["in_progress", "revision_requested", "ready_for_delivery", "delivered"].includes(commission.status)) {
    return NextResponse.json({ success: false, message: "Commission is not ready for deliverables." }, { status: 409 });
  }
  const fileId = crypto.randomUUID();
  const path = `deliveries/${id}/${fileId}.${EXTENSIONS[file.type.toLowerCase()]}`;
  const { error: uploadError } = await admin.storage.from("commission-private")
    .upload(path, bytes, { contentType: file.type.toLowerCase(), upsert: false });
  if (uploadError) return NextResponse.json({ success: false, message: "Private delivery storage unavailable." }, { status: 503 });
  const { error: recordError } = await admin.from("commission_files").insert({
    id: fileId, commission_id: id, kind: "deliverable", storage_path: path,
    file_name: file.name.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180),
    content_type: file.type.toLowerCase(), size_bytes: file.size,
  });
  if (recordError) {
    await admin.storage.from("commission-private").remove([path]);
    return NextResponse.json({ success: false, message: "Could not record deliverable." }, { status: 503 });
  }
  await admin.from("audit_logs").insert({ actor: auth.userEmail || "owner", action: "deliverable_uploaded",
    target_type: "commission", target_id: id, metadata: { file_id: fileId } });
  return NextResponse.json({ success: true, id: fileId });
}
