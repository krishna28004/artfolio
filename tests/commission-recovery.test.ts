import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { POST as recoverCommission } from "../src/app/api/commission/recover/route.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { _setDistributedLimiterForTesting } from "../src/shared/utils/rate-limit.ts";
import { makeTrackingToken } from "../src/features/commission/server/tracking-token.ts";
import { hashAccessToken } from "../src/features/commission/server/customer-access.ts";

process.env.SUPABASE_SERVICE_ROLE_KEY = "test_service_role_key_for_recovery_tests_64char_long_string_abc";

describe("Find My Commission — Secure Recovery Workflow", () => {
  beforeEach(() => {
    _setDistributedLimiterForTesting(null);
  });

  afterEach(() => {
    _setAdminInstanceForTesting(null);
    _setDistributedLimiterForTesting(null);
  });

  test("rejects malformed email payloads with HTTP 400", async () => {
    const invalidPayloads = [
      {},
      { email: "" },
      { email: "not-an-email" },
      { email: "@missingusername.com" },
      { email: "missingtld@domain" },
      { email: "a".repeat(256) + "@example.com" },
    ];

    for (const body of invalidPayloads) {
      const req = new NextRequest("http://localhost:3000/api/commission/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const res = await recoverCommission(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);
      assert.match(json.message, /valid email address/i);
    }
  });

  test("enforces IP and email rate limiting with HTTP 429", async () => {
    // Inject a rate limiter that denies the request
    _setDistributedLimiterForTesting({
      async limit() {
        return { success: false, limit: 5, remaining: 0, reset: Date.now() + 60000, reason: "rate_limit" } as never;
      },
    });

    const req = new NextRequest("http://localhost:3000/api/commission/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "collector@example.com" }),
    });

    const res = await recoverCommission(req);
    assert.strictEqual(res.status, 429);
    const json = await res.json();
    assert.strictEqual(json.success, false);
    assert.match(json.message, /too many/i);
    assert.strictEqual(res.headers.get("Retry-After"), "900");
  });

  test("anti-enumeration: returns identical 200 response when email is NOT found", async () => {
    // Mock Supabase returning empty array
    _setAdminInstanceForTesting({
      from(table: string) {
        assert.strictEqual(table, "commissions");
        return {
          select() { return this; },
          eq() { return this; },
          not() { return this; },
          order() { return this; },
          limit() {
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/commission/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nonexistent@example.com" }),
    });

    const res = await recoverCommission(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(
      json.message,
      "If an active commission inquiry is associated with this email address, you will receive tracking instructions shortly."
    );
    assert.strictEqual(res.headers.get("Cache-Control"), "no-store");
  });

  test("anti-enumeration: returns identical 200 response when email IS found and queues notification", async () => {
    const commissionId = crypto.randomUUID();
    const nonce = crypto.randomBytes(32).toString("base64url");
    const rawToken = makeTrackingToken(nonce);
    const tokenHash = hashAccessToken(rawToken);

    const mockCommission = {
      id: commissionId,
      name: "Sophia Carter",
      email: "sophia@example.com",
      request_reference: "AF-TESTREC001",
      tracking_nonce: nonce,
      tracking_token_hash: tokenHash,
      status: "in_progress",
      created_at: new Date().toISOString(),
    };

    const insertedEvents: Array<{ commission_id: string; event_type: string; metadata: Record<string, unknown> }> = [];
    const insertedJobs: Array<{ commission_id: string; dedupe_key: string; recipient: string; template: string }> = [];

    _setAdminInstanceForTesting({
      from(table: string) {
        if (table === "commissions") {
          return {
            select() { return this; },
            eq() { return this; },
            not() { return this; },
            order() { return this; },
            limit() {
              return Promise.resolve({ data: [mockCommission], error: null });
            },
            update() {
              return {
                eq() { return Promise.resolve({ data: null, error: null }); },
              };
            },
          };
        }
        if (table === "commission_events") {
          return {
            insert(event: { commission_id: string; actor_type: string; event_type: string; body: string; metadata: Record<string, unknown> }) {
              insertedEvents.push(event);
              return {
                select() {
                  return {
                    maybeSingle() {
                      return Promise.resolve({ data: { id: "mock-event-id-123" }, error: null });
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "notification_jobs") {
          return {
            insert(job: { commission_id: string; dedupe_key: string; recipient: string; template: string }) {
              insertedJobs.push(job);
              return Promise.resolve({ data: null, error: null });
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/commission/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "sophia@example.com" }),
    });

    const res = await recoverCommission(req);
    assert.strictEqual(res.status, 200);
    const json = await res.json();
    assert.strictEqual(json.success, true);
    // Response text must match exactly the non-existent response text
    assert.strictEqual(
      json.message,
      "If an active commission inquiry is associated with this email address, you will receive tracking instructions shortly."
    );

    // Verify recovery event was queued with metadata
    assert.strictEqual(insertedEvents.length, 1);
    assert.strictEqual(insertedEvents[0].commission_id, commissionId);
    assert.strictEqual(insertedEvents[0].event_type, "recovery_requested");

    // Verify notification job was queued with hourly dedupe key
    assert.strictEqual(insertedJobs.length, 1);
    assert.strictEqual(insertedJobs[0].commission_id, commissionId);
    assert.strictEqual(insertedJobs[0].recipient, "sophia@example.com");
    assert.match(insertedJobs[0].dedupe_key, new RegExp(`^recovery:${commissionId}:\\d{4}-\\d{2}-\\d{2}T\\d{2}$`));
  });

  test("generates and persists fresh nonce when commission lacks tracking_nonce", async () => {
    const commissionId = crypto.randomUUID();
    let updatedNonce: string | null = null;
    let updatedHash: string | null = null;

    const mockCommissionWithoutNonce = {
      id: commissionId,
      name: "Liam Vance",
      email: "liam@example.com",
      request_reference: "AF-TESTREC002",
      tracking_nonce: null, // Legacy or missing nonce
      tracking_token_hash: null,
      status: "under_review",
      created_at: new Date().toISOString(),
    };

    _setAdminInstanceForTesting({
      from(table: string) {
        if (table === "commissions") {
          return {
            select() { return this; },
            eq() { return this; },
            not() { return this; },
            order() { return this; },
            limit() {
              return Promise.resolve({ data: [mockCommissionWithoutNonce], error: null });
            },
            update(payload: { tracking_nonce: string; tracking_token_hash: string }) {
              updatedNonce = payload.tracking_nonce;
              updatedHash = payload.tracking_token_hash;
              return {
                eq() { return Promise.resolve({ data: null, error: null }); },
              };
            },
          };
        }
        if (table === "commission_events") {
          return {
            insert() {
              return {
                select() {
                  return {
                    maybeSingle() {
                      return Promise.resolve({ data: { id: "event-456" }, error: null });
                    },
                  };
                },
              };
            },
          };
        }
        if (table === "notification_jobs") {
          return {
            insert() { return Promise.resolve({ data: null, error: null }); },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as never);

    const req = new NextRequest("http://localhost:3000/api/commission/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "liam@example.com" }),
    });

    const res = await recoverCommission(req);
    assert.strictEqual(res.status, 200);

    // Verify nonce and hash were regenerated
    assert.ok(updatedNonce, "New tracking_nonce must be created");
    assert.ok(updatedHash, "New tracking_token_hash must be created");
    const regeneratedToken = makeTrackingToken(updatedNonce!);
    assert.strictEqual(hashAccessToken(regeneratedToken), updatedHash);
  });
});
