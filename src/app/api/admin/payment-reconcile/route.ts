import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyAdminAuth } from "@/features/admin/utils/auth";
import { getSupabaseAdmin } from "@/shared/services/supabase-admin";
import { getRazorpayClient } from "@/shared/services/razorpay";

const schema = z.object({ commissionId: z.string().uuid() });

async function inspect(commissionId: string) {
  const admin = getSupabaseAdmin();
  const { data: commission } = await admin.from("commissions")
    .select("id, status, price, currency, razorpay_order_id, razorpay_payment_id")
    .eq("id", commissionId).maybeSingle();
  if (!commission) return null;
  const { data: ledger } = await admin.from("payments")
    .select("id, razorpay_order_id, razorpay_payment_id, amount, currency, status")
    .eq("commission_id", commissionId);
  if (!commission.razorpay_order_id) return { commission, ledger: ledger || [], gatewayOrder: null, gatewayPayments: [] };
  const gateway = getRazorpayClient();
  const [gatewayOrder, paymentList] = await Promise.all([
    gateway.orders.fetch(commission.razorpay_order_id),
    gateway.orders.fetchPayments(commission.razorpay_order_id),
  ]);
  return { commission, ledger: ledger || [],
    gatewayOrder: { id: gatewayOrder.id, amount: Number(gatewayOrder.amount), currency: gatewayOrder.currency, status: gatewayOrder.status },
    gatewayPayments: paymentList.items.map((payment) => ({ id: payment.id, order_id: payment.order_id,
      amount: Number(payment.amount), currency: payment.currency, status: payment.status, method: payment.method })),
  };
}

export async function GET(req: NextRequest) {
  if (!(await verifyAdminAuth(req)).authorized) return NextResponse.json({ success: false }, { status: 401 });
  const parsed = schema.safeParse({ commissionId: req.nextUrl.searchParams.get("commissionId") });
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid commission ID." }, { status: 400 });
  try {
    const result = await inspect(parsed.data.commissionId);
    if (!result) return NextResponse.json({ success: false, message: "Commission not found." }, { status: 404 });
    return NextResponse.json({ success: true, data: result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[PAYMENT_RECONCILE_INSPECT_ERROR]", error);
    return NextResponse.json({ success: false, message: "Gateway inspection unavailable." }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminAuth(req);
  if (!auth.authorized) return NextResponse.json({ success: false }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Invalid commission ID." }, { status: 400 });
  try {
    const result = await inspect(parsed.data.commissionId);
    if (!result || !result.gatewayOrder) return NextResponse.json({ success: false, message: "No order to reconcile." }, { status: 409 });
    const matches = result.gatewayPayments.filter((payment) => payment.status === "captured" &&
      payment.order_id === result.commission.razorpay_order_id &&
      payment.amount === result.commission.price && payment.currency === result.commission.currency &&
      result.gatewayOrder?.amount === payment.amount && result.gatewayOrder?.currency === payment.currency);
    if (matches.length !== 1) return NextResponse.json({ success: false, message: "Expected exactly one matching captured payment; review manually." }, { status: 409 });
    const payment = matches[0];
    const { data, error } = await getSupabaseAdmin().rpc("record_commission_capture", {
      p_commission_id: parsed.data.commissionId, p_order_id: payment.order_id!,
      p_payment_id: payment.id, p_amount: payment.amount, p_currency: payment.currency,
      p_method: payment.method || null,
    });
    if (error || data !== "captured") return NextResponse.json({ success: false, message: "Ledger reconciliation failed." }, { status: 503 });
    await getSupabaseAdmin().from("audit_logs").insert({ actor: auth.userEmail || "owner", action: "payment_reconciled",
      target_type: "commission", target_id: parsed.data.commissionId,
      metadata: { payment_id: payment.id, order_id: payment.order_id } });
    return NextResponse.json({ success: true, message: "Captured payment recorded." });
  } catch (error) {
    console.error("[PAYMENT_RECONCILE_ERROR]", error);
    return NextResponse.json({ success: false, message: "Gateway reconciliation unavailable." }, { status: 503 });
  }
}
