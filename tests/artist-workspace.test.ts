import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as saveTemplate, GET as listTemplates } from "../src/app/api/admin/quote-templates/route.ts";
import { GET as listCommissions } from "../src/app/api/admin/commissions/route.ts";
import { POST as markRead } from "../src/app/api/admin/commissions/[id]/route.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";

process.env.ADMIN_EMAIL = "owner@example.com";
process.env.ADMIN_API_SECRET = "artist-workspace-test-key";
afterEach(() => _setAdminInstanceForTesting(null));

const ownerHeaders = { "x-admin-key": "artist-workspace-test-key" };
const body = { title: "Portrait", scope: "One original portrait on paper", terms: "One revision included before release", revisionAllowance: 1 };

test("quote templates reject anonymous writes and invalid owner input", async () => {
  const unauthenticated = await saveTemplate(new NextRequest("http://localhost/api/admin/quote-templates", {
    method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" },
  }));
  assert.equal(unauthenticated.status, 401);
  const invalid = await saveTemplate(new NextRequest("http://localhost/api/admin/quote-templates", {
    method: "POST", body: JSON.stringify({ ...body, terms: "short" }),
    headers: { ...ownerHeaders, "content-type": "application/json" },
  }));
  assert.equal(invalid.status, 400);
});

test("owner saves and lists editable quote templates", async () => {
  let saved: Record<string, unknown> | null = null;
  _setAdminInstanceForTesting({ from(table: string) {
    assert.equal(table, "quote_templates");
    return {
      insert(row: Record<string, unknown>) { saved = row; return { select() { return {
        async maybeSingle() { return { data: { id: "template-id", ...row }, error: null }; },
      }; } }; },
      select() { return { order() { return { data: [{ id: "template-id", ...saved }], error: null }; } }; },
    };
  } } as never);
  const response = await saveTemplate(new NextRequest("http://localhost/api/admin/quote-templates", {
    method: "POST", body: JSON.stringify(body), headers: { ...ownerHeaders, "content-type": "application/json" },
  }));
  assert.equal(response.status, 200);
  assert.equal(saved?.revision_allowance, 1);
  const listed = await listTemplates(new NextRequest("http://localhost/api/admin/quote-templates", { headers: ownerHeaders }));
  assert.equal((await listed.json()).data.length, 1);
});

test("owner inbox receives persisted unread counts and marks a commission read", async () => {
  const id = "130ecda9-2780-41a7-bb3e-5d63bab59b80";
  let readId = "";
  _setAdminInstanceForTesting({
    from(table: string) {
      assert.equal(table, "commissions");
      return { select() { return this; }, order() { return { data: [{ id, name: "Collector" }], error: null }; } };
    },
    async rpc(name: string, args?: { p_commission_id?: string; p_seen_through?: string }) {
      if (name === "commission_unread_counts") return { data: [{ commission_id: id, unread_count: 2 }], error: null };
      assert.equal(name, "mark_commission_owner_read");
      readId = args?.p_commission_id || "";
      assert.equal(new Date(args?.p_seen_through || "").toISOString(), "2026-10-12T12:00:00.000Z");
      return { data: null, error: null };
    },
  } as never);
  const list = await listCommissions(new NextRequest("http://localhost/api/admin/commissions", { headers: ownerHeaders }));
  assert.equal((await list.json()).data[0].unread_count, 2);
  const marked = await markRead(new NextRequest(`http://localhost/api/admin/commissions/${id}`, {
    method: "POST", headers: { ...ownerHeaders, "content-type": "application/json" },
    body: JSON.stringify({ seenThrough: "2026-10-12T12:00:00.000Z" }),
  }), { params: { id } });
  assert.equal(marked.status, 200);
  assert.equal(readId, id);
  const offset = await markRead(new NextRequest(`http://localhost/api/admin/commissions/${id}`, {
    method: "POST", headers: { ...ownerHeaders, "content-type": "application/json" },
    body: JSON.stringify({ seenThrough: "2026-10-12T12:00:00.000+00:00" }),
  }), { params: { id } });
  assert.equal(offset.status, 200);
});
