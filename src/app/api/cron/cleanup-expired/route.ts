import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { timingSafeEqualStr } from "@/shared/utils/crypto";

export async function POST(req: NextRequest) {
  try {
    // 1. Cron Secret Authorization
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

    if (!cronSecret || !token || !timingSafeEqualStr(token, cronSecret)) {
      console.warn("[CRON_AUTH_FAIL] Unauthorized invocation of cleanup-expired endpoint.");
      return NextResponse.json({ success: false, message: "Unauthorized clearance." }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const nowIso = new Date().toISOString();

    // 2. Select eligible expired commissions (only approved or payment_pending)
    const { data: expiredRecords, error: fetchError } = await supabaseAdmin
      .from("commissions")
      .select("id, status, expires_at")
      .in("status", ["approved", "payment_pending"])
      .lt("expires_at", nowIso);

    if (fetchError) {
      console.error("[CRON_FETCH_ERROR] Failed to query expired commissions:", fetchError);
      return NextResponse.json({ success: false, message: "Query failed." }, { status: 500 });
    }

    if (!expiredRecords || expiredRecords.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: "No expired commissions found." });
    }

    const expiredIds = expiredRecords.map((r) => r.id);

    // 3. Conditional Atomic Bulk Update: NEVER touch paid or fulfilled records
    const { data: updated, error: updateError } = await supabaseAdmin
      .from("commissions")
      .update({
        status: "expired",
        updated_at: nowIso,
      })
      .in("id", expiredIds)
      .in("status", ["approved", "payment_pending"])
      .select("id, status");

    if (updateError) {
      console.error("[CRON_UPDATE_ERROR] Failed to update commissions to expired:", updateError);
      return NextResponse.json({ success: false, message: "Update failed." }, { status: 500 });
    }

    // 4. Audit Log
    try {
      for (const rec of updated || []) {
        await supabaseAdmin.from("audit_logs").insert({
          actor: "cron_engine",
          action: "commission_expired",
          target_type: "commission",
          target_id: rec.id,
          metadata: { executionTime: nowIso },
        });
      }
    } catch (auditErr) {
      console.warn("[AUDIT_LOG_WARN] Failed to write cron audit logs:", auditErr);
    }

    return NextResponse.json({
      success: true,
      count: updated?.length || 0,
      message: `Successfully transitioned ${updated?.length || 0} expired commission(s).`,
    });
  } catch (error) {
    console.error("[CRON_CLEANUP_FATAL]", error);
    return NextResponse.json({ success: false, message: "Internal server error." }, { status: 500 });
  }
}
