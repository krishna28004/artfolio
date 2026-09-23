import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  rupeesToPaise,
  paiseToRupees,
  formatRupees,
  isValidPaise,
  isPositivePaise,
} from "../src/shared/utils/money.ts";

describe("Money Utilities - Comprehensive Financial Tests", () => {
  describe("rupeesToPaise", () => {
    test("converts standard whole numbers accurately", () => {
      assert.strictEqual(rupeesToPaise(0), 0);
      assert.strictEqual(rupeesToPaise(1), 100);
      assert.strictEqual(rupeesToPaise(10), 1000);
      assert.strictEqual(rupeesToPaise(100), 10000);
      assert.strictEqual(rupeesToPaise(5000), 500000);
    });

    test("converts decimal rupee inputs with exact decimal arithmetic", () => {
      assert.strictEqual(rupeesToPaise(5000.5), 500050);
      assert.strictEqual(rupeesToPaise(5000.50), 500050);
      assert.strictEqual(rupeesToPaise(99999.99), 9999999);
      assert.strictEqual(rupeesToPaise(0.01), 1);
      assert.strictEqual(rupeesToPaise(0.10), 10);
      assert.strictEqual(rupeesToPaise(0.99), 99);
    });

    test("rejects more than two decimal places (fractional paise)", () => {
      assert.throws(() => rupeesToPaise(10.001), /fractional paise are invalid/);
      assert.throws(() => rupeesToPaise(5000.999), /fractional paise are invalid/);
    });

    test("rejects invalid, negative, NaN, Infinity and non-finite inputs", () => {
      assert.throws(() => rupeesToPaise(-1), /cannot be negative/);
      assert.throws(() => rupeesToPaise(-5000), /cannot be negative/);
      assert.throws(() => rupeesToPaise(NaN), /Invalid rupee amount/);
      assert.throws(() => rupeesToPaise(Infinity), /Invalid rupee amount/);
      assert.throws(() => rupeesToPaise(-Infinity), /Invalid rupee amount/);
      // @ts-expect-error Testing invalid runtime types
      assert.throws(() => rupeesToPaise("5000"), /Invalid rupee amount/);
      // @ts-expect-error Testing invalid runtime types
      assert.throws(() => rupeesToPaise(null), /Invalid rupee amount/);
      // @ts-expect-error Testing invalid runtime types
      assert.throws(() => rupeesToPaise(undefined), /Invalid rupee amount/);
    });
  });

  describe("paiseToRupees", () => {
    test("converts integer paise to rupees safely", () => {
      assert.strictEqual(paiseToRupees(0), 0);
      assert.strictEqual(paiseToRupees(100), 1);
      assert.strictEqual(paiseToRupees(500000), 5000);
      assert.strictEqual(paiseToRupees(500050), 5000.5);
      assert.strictEqual(paiseToRupees(1), 0.01);
      assert.strictEqual(paiseToRupees(9999999), 99999.99);
    });

    test("rejects invalid, negative, non-integer or non-safe paise", () => {
      assert.throws(() => paiseToRupees(-100), /Invalid paise amount/);
      assert.throws(() => paiseToRupees(100.5), /Invalid paise amount/);
      assert.throws(() => paiseToRupees(NaN), /Invalid paise amount/);
      assert.throws(() => paiseToRupees(Infinity), /Invalid paise amount/);
      // @ts-expect-error Testing invalid runtime types
      assert.throws(() => paiseToRupees("500000"), /Invalid paise amount/);
      // @ts-expect-error Testing invalid runtime types
      assert.throws(() => paiseToRupees(null), /Invalid paise amount/);
      // @ts-expect-error Testing invalid runtime types
      assert.throws(() => paiseToRupees(undefined), /Invalid paise amount/);
    });
  });

  describe("formatRupees", () => {
    test("formats valid paise into INR currency display correctly", () => {
      const formatted5k = formatRupees(500000);
      assert.ok(formatted5k.includes("₹") || formatted5k.includes("INR"));
      assert.ok(formatted5k.includes("5,000"));

      const formatted0 = formatRupees(0);
      assert.ok(formatted0.includes("0"));

      const formattedDec = formatRupees(500050);
      assert.ok(formattedDec.includes("5,000.5"));
    });

    test("handles invalid paise gracefully without crashing", () => {
      assert.strictEqual(formatRupees(NaN), "₹0");
      assert.strictEqual(formatRupees(-500), "₹0");
      assert.strictEqual(formatRupees(50.5), "₹0");
      // @ts-expect-error Testing invalid runtime type
      assert.strictEqual(formatRupees("100"), "₹0");
    });
  });

  describe("isValidPaise and isPositivePaise", () => {
    test("validates integer paise correctness", () => {
      assert.strictEqual(isValidPaise(0), true);
      assert.strictEqual(isValidPaise(1), true);
      assert.strictEqual(isValidPaise(500000), true);
      assert.strictEqual(isValidPaise(-1), false);
      assert.strictEqual(isValidPaise(10.5), false);
      assert.strictEqual(isValidPaise(NaN), false);
      assert.strictEqual(isValidPaise(Infinity), false);
      assert.strictEqual(isValidPaise("500"), false);
      assert.strictEqual(isValidPaise(null), false);
      assert.strictEqual(isValidPaise(undefined), false);
    });

    test("validates positive paise correctness", () => {
      assert.strictEqual(isPositivePaise(0), false);
      assert.strictEqual(isPositivePaise(1), true);
      assert.strictEqual(isPositivePaise(500000), true);
      assert.strictEqual(isPositivePaise(-100), false);
    });
  });
});
