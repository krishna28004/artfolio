import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { NextRequest } from "next/server";
import sharp from "sharp";
import { POST as createArtwork } from "../src/app/api/admin/artworks/route.ts";
import { GET as getAdminArtworks } from "../src/app/api/admin/artworks/route.ts";
import { GET as getPublicArtworks } from "../src/app/api/artworks/route.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { _setPublicInstanceForTesting } from "../src/shared/services/supabase.ts";
import { getArtworkById } from "../src/features/artwork/services/artwork-service.ts";
import { ownedArtworkPaths } from "../src/features/artwork/services/artwork-upload.ts";
import { verifyAdminAuth, _setAuthClientFactoryForTesting } from "../src/features/admin/utils/auth.ts";

process.env.ADMIN_EMAIL = "owner@example.com";
process.env.ADMIN_API_SECRET = "artwork-test-secret";
afterEach(() => { _setAdminInstanceForTesting(null); _setPublicInstanceForTesting(null); _setAuthClientFactoryForTesting(null); });

const validPng = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#333333" } }).png().toBuffer();
function request(images: File[], authenticated = true) {
  const form = new FormData();
  form.append("metadata", JSON.stringify({
    title: "Fresh Portrait", artist: "Krishna Kumar", year: 2026,
    description: "Graphite study", medium: "Graphite", dimensions: "A3",
    category: "Portrait", priceInRupees: 2500, primaryIndex: 1,
    publicationStatus: "draft", saleStatus: "available", displayOrder: 0,
  }));
  for (const image of images) form.append("images", image);
  return new NextRequest("http://localhost/api/admin/artworks", {
    method: "POST", headers: authenticated ? { "x-admin-key": "artwork-test-secret" } : {}, body: form,
  });
}
const image = (name: string, bytes: Uint8Array = validPng) => new File([bytes as Uint8Array<ArrayBuffer>], name, { type: "image/png" });

test("non-owner cannot create artwork", async () => {
  const response = await createArtwork(request([image("one.png"), image("two.png")], false));
  assert.equal(response.status, 401);
});

test("invalid image content is rejected before public storage writes", async () => {
  let uploads = 0;
  _setAdminInstanceForTesting({ storage: { from() { return { upload() { uploads++; return { error: null }; } }; } } } as never);
  const response = await createArtwork(request([image("one.png"), image("fake.png", new Uint8Array(12))]));
  assert.equal(response.status, 400);
  assert.equal(uploads, 0);
});

test("draft creation saves every image, selected primary image, and paise price", async () => {
  const uploaded: string[] = [];
  let saved: Record<string, unknown> | null = null;
  _setAdminInstanceForTesting({
    storage: { from(bucket: string) {
      assert.equal(bucket, "artworks-public");
      return {
        async upload(path: string) { uploaded.push(path); return { error: null }; },
        getPublicUrl(path: string) { return { data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/artworks-public/${path}` } }; },
        async remove() { assert.fail("successful save should not remove images"); },
      };
    } },
    from(table: string) {
      assert.equal(table, "artworks");
      return { insert(row: Record<string, unknown>) { saved = row; return {
        select() { return { async single() { return { data: row, error: null }; } }; },
      }; } };
    },
  } as never);
  const response = await createArtwork(request([image("one.png"), image("two.png")]));
  assert.equal(response.status, 201);
  assert.equal(uploaded.length, 4);
  assert.equal(saved?.publication_status, "draft");
  assert.equal(saved?.price, 250000);
  assert.equal((saved?.image_urls as string[]).length, 2);
  assert.equal(saved?.image_url, (saved?.image_urls as string[])[1]);
});

test("database failure removes every newly uploaded public image", async () => {
  const uploaded: string[] = [];
  let removed: string[] = [];
  _setAdminInstanceForTesting({
    storage: { from() { return {
      async upload(path: string) { uploaded.push(path); return { error: null }; },
      getPublicUrl(path: string) { return { data: { publicUrl: `https://example.supabase.co/storage/v1/object/public/artworks-public/${path}` } }; },
      async remove(paths: string[]) { removed = paths; return { error: null }; },
    }; } },
    from() { return { insert() { return { select() { return { async single() { return { data: null, error: { message: "database unavailable" } }; } }; } }; } }; },
  } as never);
  const response = await createArtwork(request([image("one.png"), image("two.png")]));
  assert.equal(response.status, 503);
  assert.deepEqual(removed, uploaded);
});

test("publication migration limits anonymous catalog reads to published artworks", () => {
  const migration = fs.readFileSync("supabase/migrations/20261011030000_artwork_publication.sql", "utf8");
  assert.match(migration, /USING \(publication_status = 'published'\)/);
  assert.match(migration, /DROP POLICY IF EXISTS "Allow public read on artworks"/);
  assert.match(migration, /artworks-public/);
});

test("a draft artwork is not returned by the public detail service", async () => {
  const predicates: [string, string][] = [];
  _setPublicInstanceForTesting({ from(table: string) {
    assert.equal(table, "artworks");
    return { select() { return this; }, eq(field: string, value: string) {
      predicates.push([field, value]);
      return this;
    }, async maybeSingle() { return { data: null, error: null }; } };
  } } as never);
  assert.equal(await getArtworkById("luminous-veil"), null);
  assert.deepEqual(predicates, [["id", "luminous-veil"], ["publication_status", "published"]]);
});

test("unpublishing the exhibition returns an empty public gallery", async () => {
  _setAdminInstanceForTesting({ from(table: string) {
    assert.equal(table, "exhibition_settings");
    return { select() { return this; }, eq() { return this; },
      async maybeSingle() { return { data: { is_published: false }, error: null }; } };
  } } as never);
  const response = await getPublicArtworks(new NextRequest("http://localhost/api/artworks?exhibition=1"));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).data, []);
});

test("only the owner can preview staged exhibition positions", async () => {
  const response = await getAdminArtworks(new NextRequest("http://localhost/api/admin/artworks?view=exhibition-preview"));
  assert.equal(response.status, 401);
});

test("the owner publishes staged placements through the transactional RPC", async () => {
  let args: Record<string, unknown> | null = null;
  _setAdminInstanceForTesting({ async rpc(name: string, values: Record<string, unknown>) {
    assert.equal(name, "set_exhibition_publication");
    args = values;
    return { data: true, error: null };
  } } as never);
  const response = await createArtwork(new NextRequest("http://localhost/api/admin/artworks", {
    method: "POST", headers: { "content-type": "application/json", "x-admin-key": "artwork-test-secret" },
    body: JSON.stringify({ action: "publish_exhibition" }),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(args, { p_publish: true, p_actor: "owner@example.com" });
});

test("asset cleanup accepts only this artwork's own Supabase paths", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    assert.deepEqual(ownedArtworkPaths([
      "https://attacker.example/storage/v1/object/public/artworks-public/artworks/one/x.webp",
      "https://example.supabase.co/storage/v1/object/public/artworks-public/artworks/two/x.webp",
      "https://example.supabase.co/storage/v1/object/public/artworks-public/artworks/one/x.webp",
    ], "one"), ["artworks/one/x.webp", "artworks/one/x-thumb.webp"]);
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  }
});

test("owner session needs aal2 for sensitive writes", async () => {
  let level = "aal1";
  _setAuthClientFactoryForTesting(async () => ({ auth: {
    async getUser() { return { data: { user: { id: "ef6e86d7-6301-4898-92dd-60ca94dc26c5", email: "owner@example.com", email_confirmed_at: "2026-01-01" } }, error: null }; },
    async getClaims() { return { data: { claims: { sub: "ef6e86d7-6301-4898-92dd-60ca94dc26c5", session_id: "4a6f0fbb-9c6a-44e5-ade7-8ed37aac4c3e" } }, error: null }; },
    mfa: { async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: level }, error: null }; } },
  } }) as never);
  _setAdminInstanceForTesting({ async rpc() { return { data: true, error: null }; } } as never);
  const req = new NextRequest("http://localhost/api/admin/artworks");
  assert.equal((await verifyAdminAuth(req, { requireMfa: true })).authorized, false);
  assert.equal((await verifyAdminAuth(req)).authorized, false);
  assert.equal((await verifyAdminAuth(req, { requireMfa: false })).authorized, true);
  level = "aal2";
  assert.equal((await verifyAdminAuth(req, { requireMfa: true })).authorized, true);
});

test("owner email cannot be forged through account metadata", async () => {
  _setAuthClientFactoryForTesting(async () => ({ auth: {
    async getUser() { return { data: { user: { email: "other@example.com", user_metadata: { role: "admin" } } }, error: null }; },
  } }) as never);
  assert.equal((await verifyAdminAuth(new NextRequest("http://localhost/api/admin/artworks"))).authorized, false);
});
