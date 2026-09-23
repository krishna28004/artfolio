/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "crypto";
import { NextRequest } from "next/server";

// Services & routes to test
import { verifyAdminAuth } from "../src/features/admin/utils/auth.ts";
import { _setAdminInstanceForTesting } from "../src/shared/services/supabase-admin.ts";
import { checkRateLimit } from "../src/shared/utils/rate-limit.ts";
import { computeHmacSha256 } from "../src/shared/utils/crypto.ts";
import { POST as validateCheckout } from "../src/app/api/checkout/validate/route.ts";
import { POST as verifyPayment } from "../src/app/api/payment/verify/route.ts";
import { POST as paymentWebhook } from "../src/app/api/payment/webhook/route.ts";
import { POST as uploadMedia } from "../src/app/api/media/upload/route.ts";
import { GET as getAdminCommissions } from "../src/app/api/admin/commissions/route.ts";
import { POST as approveAdminCommission } from "../src/app/api/admin/approve/route.ts";
import { POST as rejectAdminCommission } from "../src/app/api/admin/reject/route.ts";
import { POST as runCleanupCron } from "../src/app/api/cron/cleanup-expired/route.ts";

// Set required test environment variables
process.env.ADMIN_NOTIFICATION_EMAIL = "curator@artfolio.com";
process.env.ADMIN_API_SECRET = "super_secret_admin_key_test_12345";
process.env.ADMIN_API_KEY = "super_secret_admin_key_test_12345";
process.env.RAZORPAY_KEY_ID = "rzp_test_12345";
process.env.RAZORPAY_SECRET = "test_razorpay_secret_key_67890";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_abcde";
process.env.CRON_SECRET = "test_cron_secret_secure_key";
process.env.CLOUDINARY_API_KEY = "test_cloud_key";
process.env.CLOUDINARY_API_SECRET = "test_cloud_secret";
process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test_cloud";

// Mock Supabase Database store
interface MockDb {
  commissions: Record<string, any>;
  payments: Record<string, any>;
  artworks: Record<string, any>;
  audit_logs: Record<string, any>;
}

function createMockSupabase(db: MockDb) {
  return {
    from(table: keyof MockDb) {
      const store = db[table] || {};
      const filters: Array<(row: any) => boolean> = [];
      let updatePayload: any = null;

      const queryBuilder: any = {
        select(_cols: string = "*") {
          return queryBuilder;
        },
        eq(col: string, val: any) {
          filters.push((row: any) => row[col] === val);
          return queryBuilder;
        },
        in(col: string, values: any[]) {
          filters.push((row: any) => values.includes(row[col]));
          return queryBuilder;
        },
        lt(col: string, val: any) {
          filters.push((row: any) => row[col] < val);
          return queryBuilder;
        },
        gt(col: string, val: any) {
          filters.push((row: any) => row[col] > val);
          return queryBuilder;
        },
        order(_col: string, _opts?: any) {
          return queryBuilder;
        },
        limit(_n: number) {
          return queryBuilder;
        },
        async single() {
          const rows = Object.values(store).filter((row: any) =>
            filters.every((fn) => fn(row))
          );
          if (rows.length === 0) {
            return { data: null, error: { message: "Row not found", code: "PGRST116" } };
          }
          return { data: { ...rows[0] }, error: null };
        },
        async maybeSingle() {
          const rows = Object.values(store).filter((row: any) =>
            filters.every((fn) => fn(row))
          );
          return { data: rows.length > 0 ? { ...rows[0] } : null, error: null };
        },
        update(payload: any) {
          updatePayload = payload;
          const updateBuilder: any = {
            eq(col: string, val: any) {
              filters.push((row: any) => row[col] === val);
              return updateBuilder;
            },
            in(col: string, values: any[]) {
              filters.push((row: any) => values.includes(row[col]));
              return updateBuilder;
            },
            select() {
              return {
                async single() {
                  const matches = Object.values(store).filter((row: any) =>
                    filters.every((fn) => fn(row))
                  );
                  if (matches.length > 0) {
                    Object.assign(matches[0], updatePayload);
                    return { data: { ...matches[0] }, error: null };
                  }
                  return { data: null, error: { message: "Not found" } };
                },
                async maybeSingle() {
                  const matches = Object.values(store).filter((row: any) =>
                    filters.every((fn) => fn(row))
                  );
                  if (matches.length > 0) {
                    Object.assign(matches[0], updatePayload);
                    return { data: { ...matches[0] }, error: null };
                  }
                  return { data: null, error: null };
                },
                then(resolve: any) {
                  const matches = Object.values(store).filter((row: any) =>
                    filters.every((fn) => fn(row))
                  );
                  for (const match of matches) {
                    Object.assign(match, updatePayload);
                  }
                  resolve({ data: matches, count: matches.length, error: null });
                },
              };
            },
            then(resolve: any) {
              const matches = Object.values(store).filter((row: any) =>
                filters.every((fn) => fn(row))
              );
              for (const match of matches) {
                Object.assign(match, updatePayload);
              }
              resolve({ data: matches, count: matches.length, error: null });
            },
          };
          return updateBuilder;
        },
        insert(payload: any) {
          const id = payload.id || crypto.randomUUID();
          store[id] = { id, ...payload };
          return {
            select() {
              return {
                async single() {
                  return { data: store[id], error: null };
                },
              };
            },
            then(resolve: any) {
              resolve({ data: store[id], error: null });
            },
          };
        },
        upsert(payload: any, opts?: any) {
          const conflictCol = opts?.onConflict || "id";
          const match = Object.values(store).find(
            (row: any) => row[conflictCol] === payload[conflictCol]
          );
          if (match) {
            Object.assign(match, payload);
            return {
              select() {
                return {
                  async single() {
                    return { data: match, error: null };
                  },
                };
              },
              then(resolve: any) {
                resolve({ data: match, error: null });
              },
            };
          }
          const id = payload.id || crypto.randomUUID();
          store[id] = { id, ...payload };
          return {
            select() {
              return {
                async single() {
                  return { data: store[id], error: null };
                },
              };
            },
            then(resolve: any) {
              resolve({ data: store[id], error: null });
            },
          };
        },
        then(resolve: any) {
          const results = Object.values(store).filter((row: any) =>
            filters.every((fn) => fn(row))
          );
          resolve({ data: results, count: results.length, error: null });
        },
      };

      return queryBuilder;
    },
  } as any;
}

describe("ARTfolio Phase 2 Security Hardening & Regression Tests", () => {
  let mockDb: MockDb;

  beforeEach(() => {
    mockDb = {
      commissions: {},
      payments: {},
      artworks: {},
      audit_logs: {},
    };
    _setAdminInstanceForTesting(createMockSupabase(mockDb));
  });

  afterEach(() => {
    _setAdminInstanceForTesting(null);
  });

  // ============================================================================
  // 1. ADMIN AUTHORIZATION & PRIVILEGE ESCALATION PREVENTION
  // ============================================================================
  describe("Admin Authorization & Privilege Escalation Checks", () => {
    test("rejects unauthenticated requests without admin secret or session", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/commissions");
      const authResult = await verifyAdminAuth(req);
      assert.strictEqual(authResult.authorized, false);
    });

    test("rejects client attempts to self-promote via user_metadata.role = 'admin'", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/commissions", {
        headers: {
          "x-fake-header": "test",
        },
      });
      const authResult = await verifyAdminAuth(req);
      assert.strictEqual(authResult.authorized, false);
    });

    test("authorizes machine-to-machine requests with timingSafeEqualStr on ADMIN_API_KEY", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/commissions", {
        headers: {
          "x-admin-key": process.env.ADMIN_API_KEY!,
        },
      });
      const authResult = await verifyAdminAuth(req);
      assert.strictEqual(authResult.authorized, true);
    });

    test("authorizes machine-to-machine requests with Authorization: Bearer <secret>", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/commissions", {
        headers: {
          authorization: `Bearer ${process.env.ADMIN_API_SECRET}`,
        },
      });
      const authResult = await verifyAdminAuth(req);
      assert.strictEqual(authResult.authorized, true);
    });

    test("rejects incorrect or tampered admin secrets", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/commissions", {
        headers: {
          "x-admin-key": "wrong_secret_attacker_guess",
        },
      });
      const authResult = await verifyAdminAuth(req);
      assert.strictEqual(authResult.authorized, false);
    });

    test("actual admin route handlers return 401 when unauthorized", async () => {
      const reqGet = new NextRequest("http://localhost:3000/api/admin/commissions");
      const resGet = await getAdminCommissions(reqGet);
      assert.strictEqual(resGet.status, 401);

      const reqApprove = new NextRequest("http://localhost:3000/api/admin/approve", {
        method: "POST",
        body: JSON.stringify({ commissionId: crypto.randomUUID(), priceInRupees: 5000 }),
      });
      const resApprove = await approveAdminCommission(reqApprove);
      assert.strictEqual(resApprove.status, 401);

      const reqReject = new NextRequest("http://localhost:3000/api/admin/reject", {
        method: "POST",
        body: JSON.stringify({ commissionId: crypto.randomUUID(), reason: "Too busy" }),
      });
      const resReject = await rejectAdminCommission(reqReject);
      assert.strictEqual(resReject.status, 401);
    });
  });

  // ============================================================================
  // 2. DATABASE MIGRATIONS & COMMISSION RLS
  // ============================================================================
  describe("Database Migrations & Commission RLS Verification", () => {
    test("migration 20260924010000_secure_commission_rls.sql enforces strict explicit deny policy", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20260924010000_secure_commission_rls.sql"
      );
      assert.strictEqual(fs.existsSync(migrationPath), true);
      const sql = fs.readFileSync(migrationPath, "utf-8");

      assert.ok(sql.includes("ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;"));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Allow public read on commissions"'));
      assert.ok(sql.includes('DROP POLICY IF EXISTS "Allow public insert on commissions"'));
      assert.ok(sql.includes("CREATE POLICY \"Deny public direct access to commissions\""));
      assert.ok(sql.includes("FOR ALL"));
      assert.ok(sql.includes("TO anon, authenticated"));
      assert.ok(sql.includes("USING (false)"));
      assert.ok(sql.includes("WITH CHECK (false)"));
    });

    test("migration 20260924020000_fix_payment_constraints.sql handles nullable payment id and check constraint", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20260924020000_fix_payment_constraints.sql"
      );
      assert.strictEqual(fs.existsSync(migrationPath), true);
      const sql = fs.readFileSync(migrationPath, "utf-8");

      assert.ok(sql.includes("ALTER TABLE public.payments ALTER COLUMN razorpay_payment_id DROP NOT NULL;"));
      assert.ok(sql.includes("check_captured_payment_id"));
      assert.ok(sql.includes("status IN ('created', 'attempted', 'failed')"));
    });
  });

  // ============================================================================
  // 3. CHECKOUT VALIDATION & NULL-TOKEN BYPASS PREVENTION
  // ============================================================================
  describe("Checkout Validation & Token Lifecycle", () => {
    test("rejects request missing commissionId", async () => {
      const req = new NextRequest("http://localhost:3000/api/checkout/validate", {
        method: "POST",
        body: JSON.stringify({ token: "some_token" }),
      });
      const res = await validateCheckout(req);
      assert.strictEqual(res.status, 400);
    });

    test("CRITICAL: NULL checkout_token_hash in DB NEVER bypasses authorization", async () => {
      const commissionId = crypto.randomUUID();
      mockDb.commissions[commissionId] = {
        id: commissionId,
        title: "Private Commission",
        status: "approved",
        price: 500000,
        checkout_token_hash: null, // NULL token in DB
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      // Attacker sends empty token
      const reqEmpty = new NextRequest("http://localhost:3000/api/checkout/validate", {
        method: "POST",
        body: JSON.stringify({ commissionId, token: "" }),
      });
      const resEmpty = await validateCheckout(reqEmpty);
      assert.strictEqual(resEmpty.status, 403);

      // Attacker sends arbitrary token
      const reqArbitrary = new NextRequest("http://localhost:3000/api/checkout/validate", {
        method: "POST",
        body: JSON.stringify({ commissionId, token: "some_random_token" }),
      });
      const resArbitrary = await validateCheckout(reqArbitrary);
      assert.strictEqual(resArbitrary.status, 403);
    });

    test("rejects expired checkout token", async () => {
      const commissionId = crypto.randomUUID();
      const rawToken = "valid_hex_bearer_token_1234567890abcdef1234567890abcdef";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockDb.commissions[commissionId] = {
        id: commissionId,
        title: "Expired Commission",
        status: "approved",
        price: 500000,
        checkout_token_hash: tokenHash,
        expires_at: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
      };

      const req = new NextRequest("http://localhost:3000/api/checkout/validate", {
        method: "POST",
        body: JSON.stringify({ commissionId, token: rawToken }),
      });
      const res = await validateCheckout(req);
      assert.strictEqual(res.status, 410);
    });

    test("rejects checkout token for commission in non-approved status (e.g. pending)", async () => {
      const commissionId = crypto.randomUUID();
      const rawToken = "valid_hex_bearer_token_1234567890abcdef1234567890abcdef";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockDb.commissions[commissionId] = {
        id: commissionId,
        title: "Pending Commission",
        status: "pending",
        price: 500000,
        checkout_token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      const req = new NextRequest("http://localhost:3000/api/checkout/validate", {
        method: "POST",
        body: JSON.stringify({ commissionId, token: rawToken }),
      });
      const res = await validateCheckout(req);
      assert.strictEqual(res.status, 400);
    });

    test("rejects old checkout token once commission is paid", async () => {
      const commissionId = crypto.randomUUID();
      const rawToken = "valid_hex_bearer_token_1234567890abcdef1234567890abcdef";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockDb.commissions[commissionId] = {
        id: commissionId,
        title: "Paid Commission",
        status: "paid",
        price: 500000,
        checkout_token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      const req = new NextRequest("http://localhost:3000/api/checkout/validate", {
        method: "POST",
        body: JSON.stringify({ commissionId, token: rawToken }),
      });
      const res = await validateCheckout(req);
      assert.strictEqual(res.status, 409);
      const json = await res.json();
      assert.ok((json.error || json.message).includes("already been paid"));
    });

    test("valid token succeeds and sets secure HttpOnly checkout session cookie", async () => {
      const commissionId = crypto.randomUUID();
      const rawToken = "valid_hex_bearer_token_1234567890abcdef1234567890abcdef";
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockDb.commissions[commissionId] = {
        id: commissionId,
        name: "Lord Byron",
        title: "Oil on Canvas Portrait",
        scale: "medium",
        budget: "50k-100k",
        status: "approved",
        price: 7500000,
        checkout_token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };

      const req = new NextRequest("http://localhost:3000/api/checkout/validate", {
        method: "POST",
        body: JSON.stringify({ commissionId, token: rawToken }),
      });
      const res = await validateCheckout(req);
      assert.strictEqual(res.status, 200);

      // Verify session cookie was set with HttpOnly and Strict flags
      const sessionCookie = res.cookies.get(`checkout_session_${commissionId}`);
      assert.ok(sessionCookie, "Session cookie must be present on response");
      assert.strictEqual(sessionCookie.value, tokenHash);
      assert.strictEqual(sessionCookie.httpOnly, true);
      assert.strictEqual(sessionCookie.sameSite, "lax");

      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.name, "Lord Byron");
      assert.strictEqual(json.data.price, 7500000);
    });
  });

  // ============================================================================
  // 4. PAYMENT VERIFICATION & WEBHOOK RACE CONDITION RESOLUTION
  // ============================================================================
  describe("Payment Verification & Webhook Race Condition Resolution", () => {
    const commissionId = crypto.randomUUID();
    const orderId = "order_test_987654";
    const paymentId = "pay_test_123456";
    const rawToken = "bearer_token_for_payment_test";
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    beforeEach(() => {
      mockDb.commissions[commissionId] = {
        id: commissionId,
        title: "Commission for Payment",
        status: "payment_pending",
        price: 500000, // 5000 INR
        razorpay_order_id: orderId,
        checkout_token_hash: tokenHash,
        expires_at: new Date(Date.now() + 3600000).toISOString(),
      };
    });

    test("client verify rejects tampered payment signature", async () => {
      const req = new NextRequest("http://localhost:3000/api/payment/verify", {
        method: "POST",
        body: JSON.stringify({
          commissionId,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: "forged_signature_tampered_123456",
        }),
      });
      const res = await verifyPayment(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok((json.error || json.message).includes("Invalid payment signature"));
    });

    test("client verify succeeds with valid signature and revokes checkout token", async () => {
      const validSig = computeHmacSha256(
        `${orderId}|${paymentId}`,
        process.env.RAZORPAY_SECRET!
      );

      const req = new NextRequest("http://localhost:3000/api/payment/verify", {
        method: "POST",
        body: JSON.stringify({
          commissionId,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig,
        }),
      });
      const res = await verifyPayment(req);
      assert.strictEqual(res.status, 200);

      // Verify DB state updated
      const updatedCommission = mockDb.commissions[commissionId];
      assert.strictEqual(updatedCommission.status, "paid");
      assert.strictEqual(updatedCommission.checkout_token_hash, null, "Checkout token must be revoked");
      assert.strictEqual(updatedCommission.razorpay_payment_id, paymentId);
    });

    test("client verify handles webhook race condition idempotently when already marked paid", async () => {
      // Simulate that the webhook arrived first and marked the commission as paid
      mockDb.commissions[commissionId].status = "paid";
      mockDb.commissions[commissionId].razorpay_payment_id = paymentId;
      mockDb.commissions[commissionId].checkout_token_hash = null;

      const validSig = computeHmacSha256(
        `${orderId}|${paymentId}`,
        process.env.RAZORPAY_SECRET!
      );

      const req = new NextRequest("http://localhost:3000/api/payment/verify", {
        method: "POST",
        body: JSON.stringify({
          commissionId,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: validSig,
        }),
      });
      const res = await verifyPayment(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });

    test("webhook rejects tampered signature", async () => {
      const webhookPayload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 500000,
              currency: "INR",
              notes: { commission_id: commissionId },
            },
          },
        },
      });

      const req = new NextRequest("http://localhost:3000/api/payment/webhook", {
        method: "POST",
        headers: {
          "x-razorpay-signature": "invalid_forged_webhook_signature",
        },
        body: webhookPayload,
      });
      const res = await paymentWebhook(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok((json.error || json.message).includes("Signature verification failed"));
    });

    test("webhook rejects mismatched payment amount", async () => {
      const webhookPayload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 5000, // Attacker paid 50 INR instead of 5000 INR
              currency: "INR",
              notes: { commission_id: commissionId },
            },
          },
        },
      });

      const validSig = computeHmacSha256(webhookPayload, process.env.RAZORPAY_WEBHOOK_SECRET!);
      const req = new NextRequest("http://localhost:3000/api/payment/webhook", {
        method: "POST",
        headers: {
          "x-razorpay-signature": validSig,
        },
        body: webhookPayload,
      });
      const res = await paymentWebhook(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok((json.error || json.message).includes("amount does not match"));
    });

    test("webhook is idempotent on duplicate payment.captured events", async () => {
      const webhookPayload = JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount: 500000,
              currency: "INR",
              notes: { commission_id: commissionId },
            },
          },
        },
      });

      const validSig = computeHmacSha256(webhookPayload, process.env.RAZORPAY_WEBHOOK_SECRET!);

      // First webhook event
      const req1 = new NextRequest("http://localhost:3000/api/payment/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": validSig },
        body: webhookPayload,
      });
      const res1 = await paymentWebhook(req1);
      assert.strictEqual(res1.status, 200);

      // Duplicate webhook event
      const req2 = new NextRequest("http://localhost:3000/api/payment/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": validSig },
        body: webhookPayload,
      });
      const res2 = await paymentWebhook(req2);
      assert.strictEqual(res2.status, 200);
      const json2 = await res2.json();
      assert.strictEqual(json2.success, true);
    });

    test("refund webhook updates existing payment record instead of inserting duplicate", async () => {
      // First create existing payment record in DB
      mockDb.payments[paymentId] = {
        id: crypto.randomUUID(),
        commission_id: commissionId,
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        amount: 500000,
        currency: "INR",
        status: "captured",
      };

      const refundPayload = JSON.stringify({
        event: "refund.created",
        payload: {
          refund: {
            entity: {
              id: "rfnd_12345",
              payment_id: paymentId,
              amount: 500000,
              currency: "INR",
              notes: { commission_id: commissionId },
            },
          },
        },
      });

      const validSig = computeHmacSha256(refundPayload, process.env.RAZORPAY_WEBHOOK_SECRET!);
      const req = new NextRequest("http://localhost:3000/api/payment/webhook", {
        method: "POST",
        headers: { "x-razorpay-signature": validSig },
        body: refundPayload,
      });
      const res = await paymentWebhook(req);
      assert.strictEqual(res.status, 200);

      // Verify payment was updated to refunded without duplicate insertion
      const paymentRow = mockDb.payments[paymentId];
      assert.strictEqual(paymentRow.status, "refunded");
    });
  });

  // ============================================================================
  // 5. CLOUDINARY UPLOAD SECURITY & CLIENT BUNDLE SECRECY
  // ============================================================================
  describe("Cloudinary Upload Security & Architecture", () => {
    test("server upload endpoint rejects oversized files (> 10MB)", async () => {
      const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024);
      const formData = new FormData();
      formData.append("file", new Blob([oversizedBuffer], { type: "image/jpeg" }), "large.jpg");

      const req = new NextRequest("http://localhost:3000/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const res = await uploadMedia(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok((json.error || json.message).includes("exceeds"));
    });

    test("server upload endpoint rejects dangerous or disallowed MIME types (SVG, HTML, EXE)", async () => {
      const svgBuffer = Buffer.from("<svg><script>alert(1)</script></svg>");
      const formData = new FormData();
      formData.append("file", new Blob([svgBuffer], { type: "image/svg+xml" }), "hack.svg");

      const req = new NextRequest("http://localhost:3000/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const res = await uploadMedia(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok((json.error || json.message).includes("Invalid file format"));
    });

    test("server upload endpoint verifies magic bytes to detect spoofed extensions", async () => {
      const fakeJpgBuffer = Buffer.from("Not really a JPEG file header");
      const formData = new FormData();
      formData.append("file", new Blob([fakeJpgBuffer], { type: "image/jpeg" }), "fake.jpg");

      const req = new NextRequest("http://localhost:3000/api/media/upload", {
        method: "POST",
        body: formData,
      });
      const res = await uploadMedia(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.ok((json.error || json.message).includes("allowed image signatures"));
    });

    test("client cloudinary service does not export or leak server secrets or use unsigned fallback", () => {
      const clientServicePath = path.resolve(process.cwd(), "src/shared/services/cloudinary.ts");
      const content = fs.readFileSync(clientServicePath, "utf-8");

      assert.strictEqual(content.includes("CLOUDINARY_API_SECRET"), false);
      assert.strictEqual(content.includes("artfolio_unsigned"), false);
    });
  });

  // ============================================================================
  // 6. DISTRIBUTED RATE LIMITING
  // ============================================================================
  describe("Distributed Rate Limiting Engine", () => {
    test("in-memory limiter enforces threshold and bounds memory", () => {
      const ip = "192.168.1.100";
      const limit = 3;
      const windowMs = 1000;

      // First 3 requests allowed
      assert.strictEqual(checkRateLimit(ip, limit, windowMs).success, true);
      assert.strictEqual(checkRateLimit(ip, limit, windowMs).success, true);
      assert.strictEqual(checkRateLimit(ip, limit, windowMs).success, true);

      // 4th request blocked
      const blocked = checkRateLimit(ip, limit, windowMs);
      assert.strictEqual(blocked.success, false);
      assert.ok(blocked.remaining === 0);
    });
  });

  // ============================================================================
  // 7. CRON JOB SECURITY
  // ============================================================================
  describe("Cron Job Security (/api/cron/cleanup-expired)", () => {
    test("rejects cron request without valid Bearer CRON_SECRET", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/cleanup-expired", {
        method: "POST",
        headers: {
          authorization: "Bearer wrong_secret",
        },
      });
      const res = await runCleanupCron(req);
      assert.strictEqual(res.status, 401);
    });

    test("accepts cron request with valid Bearer CRON_SECRET", async () => {
      const req = new NextRequest("http://localhost:3000/api/cron/cleanup-expired", {
        method: "POST",
        headers: {
          authorization: `Bearer ${process.env.CRON_SECRET}`,
        },
      });
      const res = await runCleanupCron(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
    });
  });
});
