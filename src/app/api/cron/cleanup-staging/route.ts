import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqualStr } from "@/shared/utils/crypto";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
  if (!secret || !timingSafeEqualStr(secret, bearer)) return NextResponse.json({ success: false }, { status: 401 });
  const admin = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: stale, error } = await admin.from("commission_files")
    .select("id, storage_path").is("commission_id", null).lt("created_at", cutoff).limit(50);
  if (error) return NextResponse.json({ success: false, message: "Cleanup query failed." }, { status: 503 });
  let removed = 0;
  for (const file of stale || []) {
    if (!/^staging\/[0-9a-f-]{36}\.(?:jpg|png|webp|pdf)$/.test(file.storage_path)) continue;
    const { error: storageError } = await admin.storage.from("commission-private").remove([file.storage_path]);
    if (storageError) continue;
    const { error: recordError } = await admin.from("commission_files").delete()
      .eq("id", file.id).is("commission_id", null);
    if (!recordError) removed++;
  }
  return NextResponse.json({ success: true, removed });
}
