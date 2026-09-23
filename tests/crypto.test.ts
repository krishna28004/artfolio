import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { timingSafeEqualStr, computeHmacSha256 } from "../src/shared/utils/crypto.ts";

describe("Cryptographic Utilities - Timing-Safe Signatures", () => {
  const secret = "test_super_secret_webhook_key_123456789";
  const payload = JSON.stringify({ event: "payment.captured", id: "order_12345" });
  const validSignature = computeHmacSha256(payload, secret);

  describe("computeHmacSha256", () => {
    test("computes deterministic hex HMAC-SHA256 signature", () => {
      const sig1 = computeHmacSha256(payload, secret);
      const sig2 = computeHmacSha256(payload, secret);
      assert.strictEqual(sig1, sig2);
      assert.strictEqual(sig1.length, 64); // SHA256 hex digest length
    });

    test("changes drastically with different secret or payload", () => {
      const sigDiffSecret = computeHmacSha256(payload, "different_secret");
      assert.notStrictEqual(validSignature, sigDiffSecret);

      const sigDiffPayload = computeHmacSha256(payload + " ", secret);
      assert.notStrictEqual(validSignature, sigDiffPayload);
    });
  });

  describe("timingSafeEqualStr", () => {
    test("returns true for identical valid signatures", () => {
      const copy = Buffer.from(validSignature).toString("utf8");
      assert.strictEqual(timingSafeEqualStr(validSignature, copy), true);
    });

    test("returns false for one-character difference (tampered)", () => {
      // Modify single character
      const tamperedChar = validSignature[0] === "a" ? "b" : "a";
      const tampered = tamperedChar + validSignature.slice(1);
      assert.strictEqual(timingSafeEqualStr(validSignature, tampered), false);

      const tamperedEnd = validSignature.slice(0, -1) + (validSignature.slice(-1) === "0" ? "1" : "0");
      assert.strictEqual(timingSafeEqualStr(validSignature, tamperedEnd), false);
    });

    test("returns false for truncated signature", () => {
      const truncated = validSignature.slice(0, 32);
      assert.strictEqual(timingSafeEqualStr(validSignature, truncated), false);
    });

    test("returns false for different-length signature (extended)", () => {
      const extended = validSignature + "ab";
      assert.strictEqual(timingSafeEqualStr(validSignature, extended), false);
    });

    test("returns false for completely different signature", () => {
      const different = "0".repeat(64);
      assert.strictEqual(timingSafeEqualStr(validSignature, different), false);
    });

    test("returns false for empty signatures or non-string inputs", () => {
      assert.strictEqual(timingSafeEqualStr("", validSignature), false);
      assert.strictEqual(timingSafeEqualStr(validSignature, ""), false);
      assert.strictEqual(timingSafeEqualStr("", ""), false);
      // @ts-expect-error Testing invalid runtime types
      assert.strictEqual(timingSafeEqualStr(null, validSignature), false);
      // @ts-expect-error Testing invalid runtime types
      assert.strictEqual(timingSafeEqualStr(validSignature, undefined), false);
    });
  });
});
