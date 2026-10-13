import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(100),
  scope: z.string().trim().min(10).max(2000),
  terms: z.string().trim().min(10).max(2000),
  revisionAllowance: z.number().int().min(0).max(20),
}).strict();

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAuth(req)).authorized) {
    return NextResponse.json({ success: false, message: "Owner access required." }, { status: 401 });
  }
  const { data, error } = await getSupabaseAdmin().from("quote_templates")
    .select("id, title, scope, terms, revision_allowance, updated_at")
    .order("title", { ascending: true });
  if (error) return NextResponse.json({ success: false, message: "Could not load quote templates." }, { status: 503 });
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminAuth(req, { requireMfa: true })).authorized) {
    return NextResponse.json({ success: false, message: "Verified owner access required." }, { status: 401 });
  }
  const parsed = templateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Check the template details." }, { status: 400 });
  const { id, title, scope, terms, revisionAllowance } = parsed.data;
  const row = { title, scope, terms, revision_allowance: revisionAllowance,
    updated_at: new Date().toISOString() };
  const query = id ? getSupabaseAdmin().from("quote_templates").update(row).eq("id", id)
    : getSupabaseAdmin().from("quote_templates").insert(row);
  const { data, error } = await query.select().maybeSingle();
  if (error) return NextResponse.json({ success: false, message: "Could not save quote template." }, { status: 503 });
  if (!data) return NextResponse.json({ success: false, message: "Quote template not found." }, { status: 404 });
  return NextResponse.json({ success: true, data });
}

export async function DELETE(req: NextRequest) {
  if (!(await verifyAdminAuth(req, { requireMfa: true })).authorized) {
    return NextResponse.json({ success: false, message: "Verified owner access required." }, { status: 401 });
  }
  const parsed = z.object({ id: z.string().uuid() }).strict().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid template ID." }, { status: 400 });
  const { data, error } = await getSupabaseAdmin().from("quote_templates")
    .delete().eq("id", parsed.data.id).select("id").maybeSingle();
  if (error) return NextResponse.json({ success: false, message: "Could not delete quote template." }, { status: 503 });
  if (!data) return NextResponse.json({ success: false, message: "Quote template not found." }, { status: 404 });
  return NextResponse.json({ success: true });
}
