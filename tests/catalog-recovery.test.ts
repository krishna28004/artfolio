import { afterEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/supabase.ts";
import { _setPublicInstanceForTesting } from "../src/shared/services/supabase.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { getArtworkCatalog, getAllArtworks, getArtworkById, mapDbArtworkToDomain, ArtworkCatalogError } from "../src/features/artwork/services/artwork-service.ts";
import { GET as catalogGET } from "../src/app/api/artworks/route.ts";
import { GET as detailGET } from "../src/app/api/artworks/[id]/route.ts";
import { serializeJsonLd } from "../src/shared/utils/html.ts";

type Row = Record<string, unknown>;
type Failure = { code: string; message?: string; details?: string };
function row(id = "legacy-work"): Row {
  return { id, title: "Persisted work", artist: "Artist", image_url: "/persisted.jpg",
    year: 2024, created_at: "2024-01-01T00:00:00Z", is_available: false,
    price: 120000, description: "", position_3d: [0, 1.6, 0], rotation_3d: [0, 0, 0], wall_identifier: null };
}
function install(config: { probeError?: Failure; rows?: Row[]; readError?: Failure; throwNetwork?: boolean }) {
  const filters: [string, unknown][] = [];
  let reads = 0;
  const client = {
    from() {
      let probe = false;
      let id: string | undefined;
      const query = {
        select(columns: string) { probe = columns === "publication_status"; return query; },
        limit() { return query; },
        order() { return query; },
        eq(field: string, value: unknown) { filters.push([field, value]); if (field === "id") id = String(value); return query; },
        async maybeSingle() { return { data: (config.rows || []).find((r) => r.id === id) || null, error: config.readError || null }; },
        then(resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) {
          if (config.throwNetwork) return Promise.reject(new Error("private-network-sentinel")).then(resolve, reject);
          if (!probe) reads++;
          return Promise.resolve(probe ? { data: [], error: config.probeError || null } :
            { data: config.rows || [], error: config.readError || null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  _setPublicInstanceForTesting(client as unknown as SupabaseClient<Database>);
  return { filters, readCount: () => reads };
}
afterEach(() => { _setPublicInstanceForTesting(null); _setAdminInstanceForTesting(null); });

describe("Catalog recovery — real service/route code with isolated provider mocks", () => {
  test("undefined publication column uses only the original anonymous public catalog", async () => {
    const client = install({ probeError: { code: "42703" }, rows: [row()] });
    const result = await getArtworkCatalog();
    assert.equal(result.status, "available"); assert.equal(result.schema, "legacy_public");
    assert.equal(result.artworks[0].id, "legacy-work");
    assert.ok(!client.filters.some(([field]) => field === "publication_status"));
    assert.equal(result.artworks[0].saleStatus, "not_for_sale");
  });
  test("modern collection requests published rows and defensively excludes drafts/archives", async () => {
    const client = install({ rows: ["published", "draft", "archived"].map((state) => ({ ...row(state), publication_status: state })) });
    assert.deepEqual((await getAllArtworks()).map((a) => a.id), ["published"]);
    assert.ok(client.filters.some(([field, value]) => field === "publication_status" && value === "published"));
  });
  test("migration completing between probe and read still hides unpublished rows", async () => {
    install({ probeError: { code: "42703" }, rows: [
      { ...row("visible"), publication_status: "published" }, { ...row("hidden"), publication_status: "draft" },
    ] });
    assert.deepEqual((await getAllArtworks()).map((a) => a.id), ["visible"]);
  });
  test("schema capability is not permanently cached after migration", async () => {
    const config: Parameters<typeof install>[0] = { probeError: { code: "42703" }, rows: [row()] };
    const client = install(config); await getAllArtworks();
    delete config.probeError; config.rows = [{ ...row(), publication_status: "published" }];
    await getAllArtworks();
    assert.ok(client.filters.some(([field, value]) => field === "publication_status" && value === "published"));
  });
  test("permission or missing-table errors never cause a legacy fallback", async () => {
    for (const code of ["42501", "42P01", "PGRST301"]) {
      const client = install({ probeError: { code }, rows: [row()] });
      assert.equal((await getArtworkCatalog()).status, "unavailable");
      assert.equal(client.readCount(), 0);
    }
  });
  test("a modern query column failure is unavailable rather than a successful empty catalog", async () => {
    install({ readError: { code: "42703" } });
    assert.equal((await getArtworkCatalog()).status, "unavailable");
    await assert.rejects(getAllArtworks(), ArtworkCatalogError);
  });
  test("network failures do not manufacture static artworks", async () => {
    install({ throwNetwork: true });
    assert.equal((await getArtworkCatalog()).status, "unavailable");
  });
  test("empty legacy and modern catalogs remain genuinely empty", async () => {
    for (const probeError of [undefined, { code: "42703" }]) {
      install({ probeError, rows: [] });
      assert.equal((await getArtworkCatalog()).status, "empty");
      assert.deepEqual(await getAllArtworks(), []);
      assert.equal(await getArtworkById("luminous-veil"), null);
    }
  });
  test("a modern response lacking publication state fails closed", async () => {
    install({ rows: [row()] });
    assert.equal((await getArtworkCatalog()).status, "unavailable");
  });
  test("draft and archived detail responses cannot escape a broken upstream filter", async () => {
    for (const publication_status of ["draft", "archived"]) {
      install({ rows: [{ ...row("hidden"), publication_status }] });
      assert.equal(await getArtworkById("hidden"), null);
    }
  });
  test("public catalog failures use HTTP 503 and no-store without provider details", async () => {
    install({ readError: { code: "42703", message: "private-provider-sentinel", details: "private-detail-sentinel" } });
    const response = await catalogGET(new NextRequest("http://localhost/api/artworks"));
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    const body = await response.text(); assert.ok(!body.includes("private")); assert.ok(!JSON.parse(body).success);
  });
  test("a detail query failure returns 503 rather than a false 404", async () => {
    install({ readError: { code: "42501" } });
    const response = await detailGET(new NextRequest("http://localhost/api/artworks/test"), { params: Promise.resolve({ id: "test" }) });
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
  });
  test("legacy exhibition reads do not need a privileged settings client", async () => {
    install({ probeError: { code: "42703" }, rows: [row()] });
    _setAdminInstanceForTesting({ from() { throw new Error("privileged-client-must-not-be-used"); } } as unknown as SupabaseClient<Database>);
    const response = await catalogGET(new NextRequest("http://localhost/api/artworks?exhibition=1"));
    assert.equal(response.status, 200); assert.equal((await response.json()).count, 1);
  });
  test("a migrated unpublished exhibition returns no artwork records", async () => {
    install({ rows: [{ ...row(), publication_status: "published", wall_identifier: "main-west-1" }] });
    _setAdminInstanceForTesting({ from() { const q = { select() { return q; }, eq() { return q; }, async maybeSingle() { return { data: { is_published: false }, error: null }; } }; return q; } } as unknown as SupabaseClient<Database>);
    const response = await catalogGET(new NextRequest("http://localhost/api/artworks?exhibition=1"));
    const body = await response.json(); assert.equal(body.exhibitionPublished, false); assert.deepEqual(body.data, []);
  });
  test("new museum slots accept fixed wing coordinates beyond the old single-room bounds", () => {
    const art = mapDbArtworkToDomain({ ...row(), publication_status: "published", wall_identifier: "east-wing-1" } as unknown as Parameters<typeof mapDbArtworkToDomain>[0]);
    assert.deepEqual(art.position3D, [25.85, 1.6, 3]);
  });
  test("an updated persisted image is not replaced by an old seed texture", () => {
    const art = mapDbArtworkToDomain(row("luminous-veil") as unknown as Parameters<typeof mapDbArtworkToDomain>[0]);
    assert.equal(art.textureUrl, "/persisted.jpg");
  });
  test("structured data cannot close its script and preserves its actual data", () => {
    const data = { name: "</script><img src=x onerror=alert(1)>" };
    const serialized = serializeJsonLd(data);
    assert.ok(!serialized.includes("<")); assert.deepEqual(JSON.parse(serialized), data);
  });
});

test("disabled launch flags reject submissions, uploads and checkout before provider access", async () => {
  const { POST: submit } = await import("../src/app/api/commission/route.ts");
  const { POST: upload } = await import("../src/app/api/media/upload/route.ts");
  const { POST: checkout } = await import("../src/app/api/payment/create-order/route.ts");
  const intake = process.env.ARTFOLIO_COMMISSIONS_ENABLED;
  const payments = process.env.ARTFOLIO_PAYMENTS_ENABLED;
  delete process.env.ARTFOLIO_COMMISSIONS_ENABLED;
  delete process.env.ARTFOLIO_PAYMENTS_ENABLED;
  try {
    for (const [route, handler] of [["commission", submit], ["media/upload", upload], ["payment/create-order", checkout]] as const) {
      const response = await handler(new NextRequest("http://localhost/api/" + route, { method: "POST" }));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  } finally {
    if (intake === undefined) delete process.env.ARTFOLIO_COMMISSIONS_ENABLED;
    else process.env.ARTFOLIO_COMMISSIONS_ENABLED = intake;
    if (payments === undefined) delete process.env.ARTFOLIO_PAYMENTS_ENABLED;
    else process.env.ARTFOLIO_PAYMENTS_ENABLED = payments;
  }
});