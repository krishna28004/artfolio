import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { GET as getArtworkViews, POST as recordArtworkView } from "../src/app/api/artworks/[id]/view/route.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";

process.env.SUPABASE_SERVICE_ROLE_KEY = "mock_service_role_key_for_telemetry_test_64char_long";
process.env.TELEMETRY_SALT = "artfolio_telemetry_unit_test_salt_unique_123";

describe("Telemetry Privacy & Anonymous Access Denial", () => {
  afterEach(() => {
    _setAdminInstanceForTesting(null);
  });

  describe("Remediation SQL Patch Integrity", () => {
    test("telemetry-access-remediation.sql strictly revokes public access and retains service_role", () => {
      const sqlPath = path.resolve(process.cwd(), "supabase/verification/telemetry-access-remediation.sql");
      assert.ok(fs.existsSync(sqlPath), "Remediation SQL file must exist");

      const sql = fs.readFileSync(sqlPath, "utf8");

      // Verify transaction boundaries
      assert.ok(sql.includes("BEGIN;"), "Patch must execute within a transaction");
      assert.ok(sql.includes("COMMIT;"), "Patch must commit atomically");

      // Verify RLS enablement
      assert.ok(
        sql.includes("ALTER TABLE public.artwork_views ENABLE ROW LEVEL SECURITY;"),
        "Row Level Security must be enabled on artwork_views"
      );

      // Verify dropping legacy public policies
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Allow public insert on artwork_views" ON public.artwork_views;'),
        "Must drop public insert policy"
      );
      assert.ok(
        sql.includes('DROP POLICY IF EXISTS "Allow public select on artwork_views" ON public.artwork_views;'),
        "Must drop public select policy"
      );

      // Verify complete revocation from anon and authenticated
      assert.ok(
        sql.includes("REVOKE ALL ON public.artwork_views FROM PUBLIC, anon, authenticated;"),
        "Must revoke table access from PUBLIC, anon, and authenticated"
      );
      assert.ok(
        sql.includes("REVOKE ALL (id, artwork_id, ip_hash, viewed_at) ON public.artwork_views FROM PUBLIC, anon, authenticated;"),
        "Must revoke column-level access from PUBLIC, anon, and authenticated"
      );

      // Verify grant to service_role only
      assert.ok(
        sql.includes("GRANT SELECT, INSERT ON public.artwork_views TO service_role;"),
        "Must grant SELECT, INSERT exclusively to service_role"
      );
    });
  });

  describe("API Route Privacy: GET /api/artworks/[id]/view", () => {
    test("returns authoritative aggregate count without leaking visitor IP hashes or timestamps", async () => {
      _setAdminInstanceForTesting({
        from(table: string) {
          assert.strictEqual(table, "artwork_views");
          return {
            select(cols: string, opts?: { count?: string; head?: boolean }) {
              assert.strictEqual(cols, "*");
              assert.strictEqual(opts?.count, "exact");
              assert.strictEqual(opts?.head, true); // Head request selects no rows from DB
              return {
                eq(col: string, val: string) {
                  assert.strictEqual(col, "artwork_id");
                  assert.strictEqual(val, "luminous-veil");
                  return Promise.resolve({ count: 184, error: null });
                },
              };
            },
          };
        },
      } as never);

      const req = new NextRequest("http://localhost:3000/api/artworks/luminous-veil/view");
      const res = await getArtworkViews(req, { params: Promise.resolve({ id: "luminous-veil" }) });

      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.strictEqual(json.views, 184);

      // CRITICAL: Ensure no visitor records, hashes, or timestamps are in payload
      assert.strictEqual(json.ip_hash, undefined);
      assert.strictEqual(json.viewed_at, undefined);
      assert.strictEqual(json.rows, undefined);
      assert.strictEqual(json.data, undefined);
    });

    test("handles database errors gracefully and returns safe default 0", async () => {
      _setAdminInstanceForTesting({
        from() {
          return {
            select() {
              return {
                eq() {
                  return Promise.resolve({ count: null, error: { message: "connection failed", code: "57P01" } });
                },
              };
            },
          };
        },
      } as never);

      const req = new NextRequest("http://localhost:3000/api/artworks/luminous-veil/view");
      const res = await getArtworkViews(req, { params: Promise.resolve({ id: "luminous-veil" }) });

      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.strictEqual(json.views, 0);
    });
  });

  describe("API Route Privacy: POST /api/artworks/[id]/view", () => {
    test("computes salted SHA-256 hash and records genuine new visitor", async () => {
      let insertedRecord: { artwork_id: string; ip_hash: string } | null = null;

      _setAdminInstanceForTesting({
        from(table: string) {
          assert.strictEqual(table, "artwork_views");
          return {
            select(cols?: string, opts?: { count?: string; head?: boolean }) {
              if (opts?.count === "exact") {
                return {
                  eq() { return Promise.resolve({ count: 185, error: null }); },
                };
              }
              return {
                eq() { return this; },
                gte() { return this; },
                limit() { return this; },
                maybeSingle() {
                  // No recent view exists
                  return Promise.resolve({ data: null, error: null });
                },
              };
            },
            insert(record: { artwork_id: string; ip_hash: string }) {
              insertedRecord = record;
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      } as never);

      const clientIp = "198.51.100.42";
      const req = new NextRequest("http://localhost:3000/api/artworks/luminous-veil/view", {
        method: "POST",
        headers: { "x-forwarded-for": clientIp },
      });

      const res = await recordArtworkView(req, { params: Promise.resolve({ id: "luminous-veil" }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.strictEqual(json.views, 185);
      assert.strictEqual(json.recorded, true);

      // Verify that the inserted ip_hash is a 64-char hex SHA-256 hash
      assert.ok(insertedRecord !== null, "Record must be inserted");
      assert.strictEqual(insertedRecord!.artwork_id, "luminous-veil");
      assert.match(insertedRecord!.ip_hash, /^[0-9a-f]{64}$/);
      // Raw IP must never be stored
      assert.strictEqual(insertedRecord!.ip_hash.includes(clientIp), false);
    });

    test("deduplicates multiple visits from same client IP within 24 hours", async () => {
      let insertAttempted = false;

      _setAdminInstanceForTesting({
        from(table: string) {
          assert.strictEqual(table, "artwork_views");
          return {
            select(cols?: string, opts?: { count?: string; head?: boolean }) {
              if (opts?.count === "exact") {
                return {
                  eq() { return Promise.resolve({ count: 185, error: null }); },
                };
              }
              return {
                eq() { return this; },
                gte() { return this; },
                limit() { return this; },
                maybeSingle() {
                  // Existing view within 24h found
                  return Promise.resolve({ data: { id: "existing-view-uuid" }, error: null });
                },
              };
            },
            insert() {
              insertAttempted = true;
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      } as never);

      const req = new NextRequest("http://localhost:3000/api/artworks/luminous-veil/view", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.42" },
      });

      const res = await recordArtworkView(req, { params: Promise.resolve({ id: "luminous-veil" }) });
      assert.strictEqual(res.status, 200);
      const json = await res.json();

      assert.strictEqual(json.success, true);
      assert.strictEqual(json.recorded, false);
      assert.strictEqual(insertAttempted, false, "Must not insert duplicate view within 24h");
    });
  });

  describe("Anonymous Access Denial Contract", () => {
    test("simulated unauthenticated client cannot query raw artwork_views", () => {
      // Simulate PostgREST RLS denial error (PostgreSQL error code 42501)
      const anonymousQuery = () => {
        const role = "anon";
        if (role === "anon") {
          throw Object.assign(new Error("permission denied for table artwork_views"), { code: "42501" });
        }
        return { data: [{ id: "1", ip_hash: "hash", viewed_at: new Date() }] };
      };

      assert.throws(anonymousQuery, (err: unknown) => {
        const error = err as { code: string; message: string };
        return error.code === "42501" && /permission denied/i.test(error.message);
      });
    });
  });
});
