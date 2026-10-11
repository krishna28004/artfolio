/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { POST } from "../src/app/api/payment/create-order/route.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { _setRazorpayInstanceForTesting } from "../src/shared/services/razorpay.ts";

const commissionId = "a3a4a5a6-b7b8-4c4d-8e8f-112233445566";
const token = "sandbox-checkout-token";
let row: Record<string, any>;
let createdOrders: number;
let paymentInsertFails: boolean;

function configure() {
  createdOrders = 0;
  paymentInsertFails = false;
  row = { id: commissionId, status: "approved", price: 500000,
    currency: "INR", quote_version: 0, accepted_quote_version: null,
    expires_at: new Date(Date.now() + 3600000).toISOString(),
    checkout_token_hash: crypto.createHash("sha256").update(token).digest("hex"),
    razorpay_order_id: null };
  _setRazorpayInstanceForTesting({ orders: { create: async () => {
    createdOrders++;
    return { id: `order_test_${createdOrders}` };
  }, fetch: async (id: string) => ({ id, amount: 500000, currency: "INR" }) } } as any);
  _setAdminInstanceForTesting({
    rpc(_name: string, args: Record<string, any>) {
      if (paymentInsertFails) return Promise.resolve({ data: null, error: { code: "test" } });
      if (row.razorpay_order_id) return Promise.resolve({ data: row.razorpay_order_id, error: null });
      row.razorpay_order_id = args.p_order_id; row.status = "payment_pending";
      return Promise.resolve({ data: args.p_order_id, error: null });
    },
    from(table: string) {
    assert.equal(table, "commissions");
    return {
      select() { return { eq() { return { single: async () => ({ data: { ...row }, error: null }) }; } }; },
    };
  } } as any);
}

function request() {
  return POST(new Request("http://localhost/api/payment/create-order", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ commissionId, token }),
  }));
}

afterEach(() => {
  _setAdminInstanceForTesting(null);
  _setRazorpayInstanceForTesting(null);
});

test("repeated checkout initiation returns the original stored order", async () => {
  configure();
  const first = await request();
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(row.razorpay_order_id, firstBody.orderId);
  assert.equal(row.status, "payment_pending");
  const second = await request();
  assert.equal(second.status, 200);
  assert.equal((await second.json()).orderId, firstBody.orderId);
  assert.equal(createdOrders, 1);
});

test("failed atomic order attachment does not expose an unrecorded order to checkout", async () => {
  configure();
  paymentInsertFails = true;
  const response = await request();
  assert.equal(response.status, 503);
  assert.equal(row.razorpay_order_id, null);
  assert.equal(row.status, "approved");
});

test("non-checkout state cannot initiate a payment order", async () => {
  configure();
  row.status = "expired";
  const response = await request();
  assert.equal(response.status, 410);
  assert.equal(createdOrders, 0);
});
