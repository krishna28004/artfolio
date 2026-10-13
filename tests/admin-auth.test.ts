import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NextRequest } from "next/server";
import { POST } from "../src/app/api/admin/auth/route.ts";
import { _setAdminLoginClientsForTesting } from "../src/features/admin/server/password-auth.ts";
import { checkDistributedRateLimit, _setDistributedLimiterForTesting, getClientIp } from "../src/shared/utils/rate-limit.ts";
process.env.ADMIN_EMAIL = "owner@example.com";
afterEach(() => _setAdminLoginClientsForTesting(null, null));
let ip = 0;
function request(body: object, origin = "http://localhost") {
  return new NextRequest("http://localhost/api/admin/auth", { method: "POST", headers: {
    origin, "content-type": "application/json", "x-forwarded-for": "192.0.2." + (++ip),
  }, body: JSON.stringify(body) });
}
const user = { email: "owner@example.com", email_confirmed_at: "2026-01-01" };
test("login rejects cross-origin requests and malformed input before contacting Auth", async () => {
  assert.equal((await POST(request({ action: "login" }, "https://attacker.example"))).status, 403);
  assert.equal((await POST(request({ action: "login", email: user.email }))).status, 400);
});
test("login verifies owner identity and sets session through the server client", async () => {
  let attempts = 0;
  _setAdminLoginClientsForTesting(async () => ({ auth: {
    async signInWithPassword() { attempts++; return { data: { user }, error: null }; },
    async signOut() { return { error: null }; },
  } }) as never, null);
  assert.equal((await POST(request({ action: "login", email: "other@example.com", password: "password" }))).status, 401);
  assert.equal(attempts, 0);
  assert.equal((await POST(request({ action: "login", email: user.email, password: "password" }))).status, 200);
  assert.equal(attempts, 1);
});
test("unverified owner is denied and the partial session cleared", async () => {
  let cleared = false;
  _setAdminLoginClientsForTesting(async () => ({ auth: {
    async signInWithPassword() { return { data: { user: { email: user.email } }, error: null }; },
    async signOut() { cleared = true; return { error: null }; },
  } }) as never, null);
  assert.equal((await POST(request({ action: "login", email: user.email, password: "password" }))).status, 401);
  assert.equal(cleared, true);
});
test("recovery returns the same response for owner, unknown email and provider failure", async () => {
  let sent = 0;
  _setAdminLoginClientsForTesting(null, () => ({ auth: {
    async resetPasswordForEmail() { sent++; return { error: { message: "private provider detail" } }; },
  } }) as never);
  const owner = await POST(request({ action: "recover", email: user.email }));
  const unknown = await POST(request({ action: "recover", email: "unknown@example.com" }));
  assert.equal(owner.status, 202); assert.equal(unknown.status, 202);
  assert.deepEqual(await owner.json(), await unknown.json()); assert.equal(sent, 1);
});
test("password reset requires recovery OTP and revokes global sessions after a successful change", async () => {
  const calls: string[] = [];
  _setAdminLoginClientsForTesting(null, () => ({ auth: {
    async verifyOtp(args: { type: string }) { assert.equal(args.type, "recovery"); calls.push("verify"); return { data: { user }, error: null }; },
    async updateUser() { calls.push("update"); return { error: null }; },
    async signOut(args: { scope: string }) { calls.push(args.scope); return { error: null }; },
  } }) as never);
  const response = await POST(request({ action: "reset", email: user.email, token: "123456", password: "new-secure-password" }));
  assert.equal(response.status, 200); assert.deepEqual(calls, ["verify", "update", "global"]);
});
test("invalid recovery OTP cannot change a password", async () => {
  _setAdminLoginClientsForTesting(null, () => ({ auth: {
    async verifyOtp() { return { data: { user: null }, error: { message: "invalid" } }; },
    async updateUser() { assert.fail("must not update"); },
    async signOut() { return { error: null }; },
  } }) as never);
  assert.equal((await POST(request({ action: "reset", email: user.email, token: "123456", password: "new-secure-password" }))).status, 401);
});
test("login account limit survives changes of source IP", async () => {
  let attempts = 0;
  _setAdminLoginClientsForTesting(async () => ({ auth: {
    async signInWithPassword() { attempts++; return { data: { user: null }, error: { message: "failed" } }; },
    async signOut() { return { error: null }; },
  } }) as never, null);
  // A unique unknown account avoids coupling to earlier tests; owner mismatch still consumes attempts.
  const email = "limit@example.com";
  for (let i = 0; i < 10; i++) assert.equal((await POST(request({ action: "login", email, password: "password" }))).status, 401);
  const limited = await POST(request({ action: "login", email, password: "password" }));
  assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get("retry-after")) > 0); assert.equal(attempts, 0);
});
test("production rejects untrusted proxy headers outside Vercel", () => {
  const env = process.env.NODE_ENV, vercel = process.env.VERCEL;
  process.env.NODE_ENV = "production"; delete process.env.VERCEL;
  try { assert.equal(getClientIp(request({}, "http://localhost")), "unknown"); }
  finally { if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
    if (vercel === undefined) delete process.env.VERCEL; else process.env.VERCEL = vercel; }
});
test("middleware permits recovery and keeps aal1 owners at the MFA login", () => {
  const middleware = fs.readFileSync("src/utils/supabase/middleware.ts", "utf8");
  assert.ok(middleware.includes('["/admin/login", "/admin/recovery"]'));
  assert.match(middleware, /currentLevel === 'aal2'/);
});

test("distributed timeouts and Redis exceptions deny production requests", async () => {
  const env = process.env.NODE_ENV; process.env.NODE_ENV = "production";
  try {
    _setDistributedLimiterForTesting({ limit: async () => ({ success: true, remaining: 10, reset: Date.now() + 1000, reason: "timeout" }) } as never);
    assert.equal((await checkDistributedRateLimit("timeout", 10, 60_000)).success, false);
    _setDistributedLimiterForTesting({ limit: async () => { throw new Error("Redis unavailable"); } } as never);
    assert.equal((await checkDistributedRateLimit("failure", 10, 60_000)).success, false);
  } finally { _setDistributedLimiterForTesting(null);
    if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env; }
});
test("quote SQL explicitly rejects nullable authorization inputs", () => {
  for (const file of ["20261011010000_private_commission_workflow.sql", "20261011020000_atomic_deliverable_release.sql"]) {
    const sql = fs.readFileSync("supabase/migrations/" + file, "utf8");
    assert.ok(sql.includes("p_quote_version IS NULL OR p_checkout_token_hash IS NULL OR p_expires_at IS NULL"));
  }
});

test("sensitive writes reject revoked, mismatched and unverifiable owner sessions", async () => {
  const { verifyAdminAuth, _setAuthClientFactoryForTesting } = await import("../src/features/admin/utils/auth.ts");
  const { _setAdminInstanceForTesting } = await import("../src/shared/services/supabase-admin.ts");
  const id = "ef6e86d7-6301-4898-92dd-60ca94dc26c5", session = "4a6f0fbb-9c6a-44e5-ade7-8ed37aac4c3e";
  let active = true, subject = id, failure = false;
  _setAuthClientFactoryForTesting(async () => ({ auth: {
    async getUser() { return { data: { user: { id, ...user } }, error: null }; },
    async getClaims() { return { data: { claims: { sub: subject, session_id: session } }, error: null }; },
    mfa: { async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: "aal2" }, error: null }; } },
  } }) as never);
  _setAdminInstanceForTesting({ async rpc(name: string, args: { p_user_id: string; p_session_id: string }) {
    assert.equal(name, "is_owner_session_active"); assert.deepEqual(args, { p_user_id: id, p_session_id: session });
    return { data: active, error: failure ? { message: "unavailable" } : null };
  } } as never);
  try {
    const req = new NextRequest("http://localhost/api/admin/artworks", { method: "POST", headers: { origin: "http://localhost" } });
    assert.equal((await verifyAdminAuth(req, { requireMfa: true })).authorized, true);
    active = false; assert.equal((await verifyAdminAuth(req, { requireMfa: true })).authorized, false);
    active = true; failure = true; assert.equal((await verifyAdminAuth(req, { requireMfa: true })).authorized, false);
    failure = false; subject = "different-user"; assert.equal((await verifyAdminAuth(req, { requireMfa: true })).authorized, false);
  } finally { _setAuthClientFactoryForTesting(null); _setAdminInstanceForTesting(null); }
});

test("intake and checkout require explicit activation before any provider call", async () => {
  const { isCommissionIntakeEnabled, isPaymentCheckoutEnabled } = await import("../src/shared/utils/release-controls.ts");
  const { POST: submit } = await import("../src/app/api/commission/route.ts");
  const { POST: upload } = await import("../src/app/api/media/upload/route.ts");
  const { POST: order } = await import("../src/app/api/payment/create-order/route.ts");
  const intake = process.env.ARTFOLIO_COMMISSIONS_ENABLED, payments = process.env.ARTFOLIO_PAYMENTS_ENABLED;
  delete process.env.ARTFOLIO_COMMISSIONS_ENABLED; delete process.env.ARTFOLIO_PAYMENTS_ENABLED;
  try {
    assert.equal(isCommissionIntakeEnabled(), false); assert.equal(isPaymentCheckoutEnabled(), false);
    for (const handler of [submit, upload, order]) {
      const response = await handler(new NextRequest("http://localhost/api/test", { method: "POST" }));
      assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    }
    process.env.ARTFOLIO_COMMISSIONS_ENABLED="true"; process.env.ARTFOLIO_PAYMENTS_ENABLED="true";
    assert.equal(isCommissionIntakeEnabled(), true); assert.equal(isPaymentCheckoutEnabled(), true);
  } finally {
    if(intake===undefined)delete process.env.ARTFOLIO_COMMISSIONS_ENABLED;else process.env.ARTFOLIO_COMMISSIONS_ENABLED=intake;
    if(payments===undefined)delete process.env.ARTFOLIO_PAYMENTS_ENABLED;else process.env.ARTFOLIO_PAYMENTS_ENABLED=payments;
  }
});

test("password-only login bootstrap exposes no commission data and needs no service client", async () => {
  const { _setAuthClientFactoryForTesting } = await import("../src/features/admin/utils/auth.ts");
  const { GET } = await import("../src/app/api/admin/commissions/route.ts");
  _setAuthClientFactoryForTesting(async () => ({ auth: {
    async getUser() { return { data: { user }, error: null }; },
  } }) as never);
  try {
    const response = await GET(new NextRequest("http://localhost/api/admin/commissions?status=auth"));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { success: true, authorized: true });
  } finally { _setAuthClientFactoryForTesting(null); }
});
