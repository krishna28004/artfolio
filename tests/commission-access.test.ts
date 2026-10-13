import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { makeTrackingToken } from "../src/features/commission/server/tracking-token.ts";
import { accessCookieName, authorizeCustomer, hashAccessToken } from "../src/features/commission/server/customer-access.ts";
import { GET as openTracking } from "../src/app/commission/track/open/route.ts";
import { GET as downloadPrivateFile } from "../src/app/api/commission/file/[id]/route.ts";

process.env.SUPABASE_SERVICE_ROLE_KEY = "isolated_test_only_service_role_key";
afterEach(() => _setAdminInstanceForTesting(null));

function mockCommissions(rows: Record<string, { id: string; tracking_token_hash: string }>) {
  _setAdminInstanceForTesting({
    from(table: string) {
      assert.equal(table, "commissions");
      return { select() { return this; }, eq(_field: string, id: string) {
        return { async maybeSingle() { return { data: rows[id] || null, error: null }; } };
      } };
    },
  } as never);
}

test("tracking link exchanges a valid bearer for a scoped HttpOnly cookie and clean URL", async () => {
  const id = crypto.randomUUID();
  const token = makeTrackingToken(crypto.randomUUID());
  mockCommissions({ [id]: { id, tracking_token_hash: hashAccessToken(token) } });
  const response = await openTracking(new NextRequest(
    `http://localhost:3000/commission/track/open?id=${id}&token=${token}`));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), `http://localhost:3000/commission/track/${id}`);
  const cookie = response.cookies.get(accessCookieName(id));
  assert.equal(cookie?.value, hashAccessToken(token));
  assert.equal(cookie?.httpOnly, true);
  assert.equal(cookie?.sameSite, "lax");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("a customer cookie cannot read another request and rotation revokes old access", async () => {
  const idA = crypto.randomUUID();
  const idB = crypto.randomUUID();
  const tokenA = makeTrackingToken(crypto.randomUUID());
  const tokenB = makeTrackingToken(crypto.randomUUID());
  const rows = {
    [idA]: { id: idA, tracking_token_hash: hashAccessToken(tokenA) },
    [idB]: { id: idB, tracking_token_hash: hashAccessToken(tokenB) },
  };
  mockCommissions(rows);
  const req = new NextRequest(`http://localhost:3000/api/commission/track?id=${idA}`, {
    headers: { cookie: `${accessCookieName(idA)}=${hashAccessToken(tokenA)}` },
  });
  assert.equal((await authorizeCustomer(req, idA))?.id, idA);
  assert.equal(await authorizeCustomer(req, idB), null);
  rows[idA].tracking_token_hash = hashAccessToken(makeTrackingToken(crypto.randomUUID()));
  assert.equal(await authorizeCustomer(req, idA), null);
});

test("invalid tracking bearer never creates an access cookie", async () => {
  const id = crypto.randomUUID();
  mockCommissions({ [id]: { id, tracking_token_hash: hashAccessToken(makeTrackingToken("different")) } });
  const response = await openTracking(new NextRequest(
    `http://localhost:3000/commission/track/open?id=${id}&token=${makeTrackingToken("invalid")}`));
  assert.equal(response.cookies.get(accessCookieName(id)), undefined);
  assert.match(response.headers.get("location") || "", /tracking=invalid/);
});

test("customer B cannot obtain a signed URL for customer A's private file", async () => {
  const idA = crypto.randomUUID();
  const idB = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const tokenB = makeTrackingToken(crypto.randomUUID());
  let signedUrlCalls = 0;
  _setAdminInstanceForTesting({
    from(table: string) {
      if (table === "commission_files") return { select() { return this; }, eq() { return {
        async maybeSingle() { return { data: { id: fileId, commission_id: idA,
          kind: "reference", storage_path: `staging/${fileId}.png` }, error: null }; },
      }; } };
      if (table === "commissions") return { select() { return this; }, eq() { return {
        async maybeSingle() { return { data: { id: idA,
          tracking_token_hash: hashAccessToken(makeTrackingToken("owner-of-A")) }, error: null }; },
      }; } };
      throw new Error(`Unexpected table ${table}`);
    },
    storage: { from() { signedUrlCalls++; throw new Error("signed URL must not be requested"); } },
  } as never);
  const req = new NextRequest(`http://localhost:3000/api/commission/file/${fileId}?commissionId=${idA}`, {
    headers: { cookie: `${accessCookieName(idB)}=${hashAccessToken(tokenB)}` },
  });
  const response = await downloadPrivateFile(req, { params: Promise.resolve({ id: fileId }) });
  assert.equal(response.status, 403);
  assert.equal(signedUrlCalls, 0);
});

test("customer cannot download a deliverable until that file is explicitly released", async () => {
  const commissionId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  const token = makeTrackingToken("release-check");
  let signedUrlCalls = 0;
  process.env.ADMIN_EMAIL = "";
  process.env.ADMIN_API_SECRET = "";
  process.env.ADMIN_API_KEY = "";
  _setAdminInstanceForTesting({
    from(table: string) {
      const query = {
        filters: [] as Array<[string, string]>,
        select() { return this; },
        eq(field: string, value: string) { this.filters.push([field, value]); return this; },
        async maybeSingle() {
          if (table === "commission_files" && this.filters.length === 1) {
            return { data: { id: fileId, commission_id: commissionId,
              kind: "deliverable", storage_path: `deliveries/${commissionId}/${fileId}.pdf` }, error: null };
          }
          if (table === "commission_files") return { data: { delivered_at: null }, error: null };
          if (table === "commissions" && this.filters[0]?.[0] === "id") {
            return { data: { id: commissionId, tracking_token_hash: hashAccessToken(token), status: "revision_requested" }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return query;
    },
    storage: { from() { signedUrlCalls++; throw new Error("unreleased file must not be signed"); } },
  } as never);
  const req = new NextRequest(`http://localhost:3000/api/commission/file/${fileId}?commissionId=${commissionId}`, {
    headers: { cookie: `${accessCookieName(commissionId)}=${hashAccessToken(token)}` },
  });
  const response = await downloadPrivateFile(req, { params: Promise.resolve({ id: fileId }) });
  assert.equal(response.status, 403);
  assert.equal(signedUrlCalls, 0);
});
