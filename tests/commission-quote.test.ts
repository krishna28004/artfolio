import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { POST as customerAction } from "../src/app/api/commission/track/action/route.ts";
import { accessCookieName, hashAccessToken } from "../src/features/commission/server/customer-access.ts";

process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated_test_only_service_role_key";
afterEach(() => _setAdminInstanceForTesting(null));

function quoteFixture(rpcError = false) {
  const id = crypto.randomUUID();
  const cookieHash = hashAccessToken(crypto.randomBytes(32).toString("base64url"));
  const quote = { id, tracking_token_hash: cookieHash, status: "quote_sent", price: 650000,
    currency: "INR", quote_version: 3, quote_scope: "Portrait drawing and private delivery",
    quote_terms: "One included revision before final delivery", revision_allowance: 1 };
  let call: { name: string; args: Record<string, unknown> } | null = null;
  _setAdminInstanceForTesting({
    from(table: string) {
      assert.equal(table, "commissions", "acceptance must use the atomic RPC, not direct table writes");
      return { select() { return this; }, eq() { return {
        async maybeSingle() { return { data: { ...quote }, error: null }; },
      }; } };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      call = { name, args };
      return rpcError ? { data: null, error: { message: "concurrent change" } } :
        { data: crypto.randomUUID(), error: null };
    },
  } as never);
  const request = () => new NextRequest("http://localhost:3000/api/commission/track/action", {
    method: "POST", headers: { "Content-Type": "application/json",
      cookie: `${accessCookieName(id)}=${cookieHash}` },
    body: JSON.stringify({ id, action: "accept_quote" }),
  });
  return { id, quote, request, getCall: () => call };
}

test("guest acceptance records the exact quote through one atomic RPC", async () => {
  const fixture = quoteFixture();
  const response = await customerAction(fixture.request());
  assert.equal(response.status, 200);
  const call = fixture.getCall();
  assert.equal(call?.name, "accept_commission_quote_with_notice");
  assert.equal(call?.args.p_commission_id, fixture.id);
  assert.equal(call?.args.p_quote_version, 3);
  assert.match(String(call?.args.p_checkout_token_hash), /^[0-9a-f]{64}$/);
  assert.ok(new Date(String(call?.args.p_expires_at)).getTime() > Date.now());
});

test("concurrently changed quote fails closed without reporting acceptance", async () => {
  const fixture = quoteFixture(true);
  const response = await customerAction(fixture.request());
  assert.equal(response.status, 409);
  assert.equal((await response.json()).success, false);
});
