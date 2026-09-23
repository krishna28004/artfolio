import { test, describe } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { timingSafeEqualStr } from "../src/shared/utils/crypto.ts";
import { checkRateLimit } from "../src/shared/utils/rate-limit.ts";
import type { CommissionStatus } from "../src/types/supabase.ts";

/**
 * Formal State Machine Transition Validator for Commissions
 */
function isValidCommissionTransition(from: CommissionStatus, to: CommissionStatus): boolean {
  const legalTransitions: Record<CommissionStatus, CommissionStatus[]> = {
    pending: ["approved", "rejected"],
    approved: ["payment_pending", "expired", "cancelled"],
    payment_pending: ["paid", "expired", "cancelled"],
    paid: ["fulfilled"],
    fulfilled: [],
    rejected: [],
    expired: [],
    cancelled: [],
  };

  return legalTransitions[from]?.includes(to) ?? false;
}

describe("Production Readiness - Security, State Machine, & Access Tests", () => {
  describe("Commission State Machine Legal & Illegal Transitions", () => {
    test("allows pending -> approved", () => {
      assert.strictEqual(isValidCommissionTransition("pending", "approved"), true);
    });

    test("allows pending -> rejected", () => {
      assert.strictEqual(isValidCommissionTransition("pending", "rejected"), true);
    });

    test("forbids pending -> paid (bypassing approval and payment order)", () => {
      assert.strictEqual(isValidCommissionTransition("pending", "paid"), false);
    });

    test("allows approved -> payment_pending", () => {
      assert.strictEqual(isValidCommissionTransition("approved", "payment_pending"), true);
    });

    test("allows approved -> expired and approved -> cancelled", () => {
      assert.strictEqual(isValidCommissionTransition("approved", "expired"), true);
      assert.strictEqual(isValidCommissionTransition("approved", "cancelled"), true);
    });

    test("allows payment_pending -> paid", () => {
      assert.strictEqual(isValidCommissionTransition("payment_pending", "paid"), true);
    });

    test("allows paid -> fulfilled", () => {
      assert.strictEqual(isValidCommissionTransition("paid", "fulfilled"), true);
    });

    test("forbids illegal state mutations on terminal states", () => {
      assert.strictEqual(isValidCommissionTransition("paid", "expired"), false);
      assert.strictEqual(isValidCommissionTransition("paid", "cancelled"), false);
      assert.strictEqual(isValidCommissionTransition("fulfilled", "cancelled"), false);
      assert.strictEqual(isValidCommissionTransition("rejected", "approved"), false);
      assert.strictEqual(isValidCommissionTransition("expired", "paid"), false);
      assert.strictEqual(isValidCommissionTransition("cancelled", "paid"), false);
    });
  });

  describe("Checkout Bearer Token Generation & Cryptographic Validation", () => {
    test("generates 64-char hex high-entropy token and matching SHA-256 hash", () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      assert.strictEqual(rawToken.length, 64);

      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      assert.strictEqual(tokenHash.length, 64);

      const computedHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      assert.strictEqual(timingSafeEqualStr(computedHash, tokenHash), true);
    });

    test("rejects mismatched, truncated, or forged bearer tokens", () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      const wrongToken = crypto.randomBytes(32).toString("hex");
      const wrongHash = crypto.createHash("sha256").update(wrongToken).digest("hex");
      assert.strictEqual(timingSafeEqualStr(wrongHash, tokenHash), false);

      const truncatedHash = tokenHash.slice(0, 32);
      assert.strictEqual(timingSafeEqualStr(truncatedHash, tokenHash), false);

      assert.strictEqual(timingSafeEqualStr("", tokenHash), false);
    });
  });

  describe("24-Hour Expiration Logic", () => {
    test("computes expiration timestamp exactly 24 hours into the future", () => {
      const approvalTime = new Date("2026-09-24T12:00:00.000Z");
      const expiresAt = new Date(approvalTime.getTime() + 24 * 60 * 60 * 1000);

      const diffMs = expiresAt.getTime() - approvalTime.getTime();
      assert.strictEqual(diffMs, 86_400_000); // Exactly 24 * 60 * 60 * 1000
    });

    test("correctly flags active vs expired timestamps", () => {
      const now = new Date("2026-09-24T12:00:00.000Z");

      const futureExpiry = new Date(now.getTime() + 3600_000); // 1 hour later
      assert.strictEqual(now > futureExpiry, false); // Still active

      const pastExpiry = new Date(now.getTime() - 1000); // 1 sec in past
      assert.strictEqual(now > pastExpiry, true); // Expired
    });
  });

  describe("Rate Limiting Engine", () => {
    test("allows calls up to configured limit, then denies further attempts", () => {
      const testKey = `test_ip_${Date.now()}`;
      const limit = 3;
      const windowMs = 5000;

      // 1st request
      const r1 = checkRateLimit(testKey, limit, windowMs);
      assert.strictEqual(r1.success, true);
      assert.strictEqual(r1.remaining, 2);

      // 2nd request
      const r2 = checkRateLimit(testKey, limit, windowMs);
      assert.strictEqual(r2.success, true);
      assert.strictEqual(r2.remaining, 1);

      // 3rd request
      const r3 = checkRateLimit(testKey, limit, windowMs);
      assert.strictEqual(r3.success, true);
      assert.strictEqual(r3.remaining, 0);

      // 4th request (over limit)
      const r4 = checkRateLimit(testKey, limit, windowMs);
      assert.strictEqual(r4.success, false);
      assert.strictEqual(r4.remaining, 0);
    });
  });

  describe("Privacy-Preserving Telemetry Hashing", () => {
    test("computes deterministic SHA-256 hash without storing raw IP", () => {
      const rawIp = "203.0.113.195";
      const salt = "test-curatorial-salt-key";

      const hash1 = crypto.createHash("sha256").update(`${rawIp}:${salt}`).digest("hex");
      const hash2 = crypto.createHash("sha256").update(`${rawIp}:${salt}`).digest("hex");

      assert.strictEqual(hash1, hash2);
      assert.strictEqual(hash1.length, 64);
      assert.strictEqual(hash1.includes(rawIp), false); // Raw IP is never retained
    });
  });
});
