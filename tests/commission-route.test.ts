/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { POST } from "../src/app/api/commission/route.ts";
import { POST as signUpload } from "../src/app/api/media/sign-upload/route.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { escapeHtml } from "../src/shared/utils/html.ts";

const rows = new Map<string, Record<string, unknown>>();
process.env.SUPABASE_SERVICE_ROLE_KEY = "unit-test-only-service-secret";
let insertFailure: string | null = null;
let eventFailure = false;
const db = {
  async rpc(name: string) {
    assert.equal(name, "ensure_commission_submission_events");
    if (eventFailure) return { data: null, error: { message: "temporary error" } };
    return { data: crypto.randomUUID(), error: null };
  },
  from(table: string) {
    if (table === "commission_events") return { insert() { return { select() { return { single: async () => ({ data: { id: crypto.randomUUID() }, error: null }) }; } }; } };
    if (table === "notification_jobs") return { upsert: async () => ({ error: null }) };
    assert.equal(table, "commissions");
    return {
      insert(row: Record<string, unknown>) {
        const key = String(row.idempotency_key);
        if (insertFailure) return Promise.resolve({ error: { code: insertFailure } });
        if (rows.has(key)) return Promise.resolve({ error: { code: "23505" } });
        rows.set(key, row);
        return Promise.resolve({ error: null });
      },
      select() {
        return {
          eq(_column: string, key: string) {
            return { maybeSingle: async () => ({ data: rows.get(key) || null, error: null }) };
          },
        };
      },
    };
  },
};

let requestNumber = 0;
function submit(body: Record<string, unknown>) {
  requestNumber++;
  return POST(new Request("http://localhost/api/commission", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${requestNumber}` },
    body: JSON.stringify(body),
  }));
}
function payload(key: string) {
  return { idempotencyKey: key, name: "Sample Patron", email: "patron@example.com",
    fileClaims: [], size: "Medium", budget: "INR 5000", deadline: "2099-01-01",
    message: "A graphite portrait of my family." };
}

afterEach(() => {
  _setAdminInstanceForTesting(null);
  rows.clear();
  insertFailure = null;
  eventFailure = false;
});

test("submission returns a persistent reference and identical retry returns the same one", async () => {
  _setAdminInstanceForTesting(db as any);
  const first = await submit(payload("retry-key-1"));
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.match(firstBody.id, /^[0-9a-f-]{36}$/);
  const retry = await submit(payload("retry-key-1"));
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).id, firstBody.id);
  assert.equal(rows.size, 1);
});

test("same idempotency key with changed details is a conflict", async () => {
  _setAdminInstanceForTesting(db as any);
  await submit(payload("retry-key-2"));
  const changed = await submit({ ...payload("retry-key-2"), message: "A different custom portrait request." });
  assert.equal(changed.status, 409);
  assert.equal(rows.size, 1);
});

test("an unrelated unique failure is not reported as a successful request", async () => {
  _setAdminInstanceForTesting(db as any);
  insertFailure = "23505";
  const response = await submit(payload("new-key-3"));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).success, false);
});

test("a saved request can retry the missing submission event and notification outbox", async () => {
  _setAdminInstanceForTesting(db as any);
  eventFailure = true;
  const first = await submit(payload("recover-event-1"));
  assert.equal(first.status, 503);
  assert.equal(rows.size, 1);
  eventFailure = false;
  const retry = await submit(payload("recover-event-1"));
  assert.equal(retry.status, 200);
  assert.equal(rows.size, 1);
});

test("legacy public asset URLs are rejected before insertion", async () => {
  _setAdminInstanceForTesting(db as any);
  const response = await submit({ ...payload("image-key-4"),
    imageUrl: "https://example.com/private.png", publicId: "artfolio_commissions/ref_123" });
  assert.equal(response.status, 400);
  assert.equal(rows.size, 0);
});

test("past deadlines are rejected server-side", async () => {
  _setAdminInstanceForTesting(db as any);
  const response = await submit({ ...payload("date-key-5"), deadline: "2020-01-01" });
  assert.equal(response.status, 400);
  assert.equal(rows.size, 0);
});

test("legacy direct upload signing is unavailable", async () => {
  assert.equal((await signUpload()).status, 410);
});

test("customer-authored content is escaped before inclusion in HTML email", () => {
  assert.equal(escapeHtml('<img src="x" onerror=\'alert(1)\'>&'),
    "&lt;img src=&quot;x&quot; onerror=&#39;alert(1)&#39;&gt;&amp;");
});
