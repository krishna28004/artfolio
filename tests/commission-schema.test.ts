import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { commissionSchema } from "../src/features/commission/schema/commission-schema.ts";

describe("Commission Schema Validation Tests", () => {
  const validCommissionPayload = {
    idempotencyKey: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    name: "Aarav Sharma",
    email: "aarav.sharma@example.com",
    imageUrl: "https://example.com/reference-art.jpg",
    publicId: "cloudinary_ref_12345",
    size: "36x48 inches",
    budget: "₹50,000 - ₹1,00,000",
    deadline: "2026-12-31",
    message: "I would like a bespoke oil painting inspired by midnight oceanic textures.",
  };

  test("accepts a fully populated valid commission request", () => {
    const parsed = commissionSchema.parse(validCommissionPayload);
    assert.strictEqual(parsed.name, "Aarav Sharma");
    assert.strictEqual(parsed.email, "aarav.sharma@example.com");
    assert.strictEqual(parsed.idempotencyKey, "a1b2c3d4-e5f6-7890-abcd-ef1234567890");
  });

  test("accepts valid request with empty or omitted optional fields", () => {
    const minimalPayload = {
      idempotencyKey: "idem-min-999",
      name: "Diya Patel",
      email: "diya@example.in",
      size: "24x36 inches",
      budget: "₹25,000",
      message: "Minimal custom artwork commission inquiry with enough length.",
      imageUrl: "",
    };
    const parsed = commissionSchema.parse(minimalPayload);
    assert.strictEqual(parsed.name, "Diya Patel");
    assert.strictEqual(parsed.imageUrl, "");
  });

  test("rejects invalid email formats", () => {
    const badEmails = [
      "not-an-email",
      "aarav@",
      "@domain.com",
      "aarav.sharma",
      "spaces in@email.com",
    ];

    for (const badEmail of badEmails) {
      assert.throws(
        () => commissionSchema.parse({ ...validCommissionPayload, email: badEmail }),
        /valid email/
      );
    }
  });

  test("rejects missing required fields", () => {
    // Missing idempotencyKey
    assert.throws(
      // @ts-expect-error Testing missing property
      () => commissionSchema.parse({ ...validCommissionPayload, idempotencyKey: undefined }),
      /expected string|invalid_type/i
    );

    // Missing name
    assert.throws(
      // @ts-expect-error Testing missing property
      () => commissionSchema.parse({ ...validCommissionPayload, name: undefined }),
      /expected string|invalid_type/i
    );

    // Missing email
    assert.throws(
      // @ts-expect-error Testing missing property
      () => commissionSchema.parse({ ...validCommissionPayload, email: undefined }),
      /expected string|invalid_type/i
    );

    // Missing message
    assert.throws(
      // @ts-expect-error Testing missing property
      () => commissionSchema.parse({ ...validCommissionPayload, message: undefined }),
      /expected string|invalid_type/i
    );
  });

  test("rejects values that violate minimum length constraints", () => {
    // Name too short (< 2 chars)
    assert.throws(
      () => commissionSchema.parse({ ...validCommissionPayload, name: "A" }),
      /Name must be at least 2 characters/
    );

    // Message too short (< 10 chars)
    assert.throws(
      () => commissionSchema.parse({ ...validCommissionPayload, message: "Too short" }),
      /Please provide more detail in your message/
    );

    // Empty size
    assert.throws(
      () => commissionSchema.parse({ ...validCommissionPayload, size: "" }),
      /specify an artwork size/
    );
  });

  test("rejects oversized values (prevent payload bomb / DOS)", () => {
    // Oversized name (> 100 chars)
    assert.throws(
      () => commissionSchema.parse({ ...validCommissionPayload, name: "A".repeat(101) }),
      /cannot exceed 100 characters/
    );

    // Oversized email (> 255 chars)
    assert.throws(
      () => commissionSchema.parse({ ...validCommissionPayload, email: "a".repeat(250) + "@test.com" }),
      /cannot exceed 255 characters/
    );

    // Oversized message (> 2000 chars)
    assert.throws(
      () => commissionSchema.parse({ ...validCommissionPayload, message: "A".repeat(2001) }),
      /cannot exceed 2000 characters/
    );
  });

  test("rejects malformed data structures", () => {
    // Non-object input
    assert.throws(() => commissionSchema.parse("invalid string"), /expected object|invalid_type/i);
    assert.throws(() => commissionSchema.parse(null), /expected object|invalid_type/i);
    assert.throws(() => commissionSchema.parse(12345), /expected object|invalid_type/i);

    // Invalid imageUrl format
    assert.throws(
      () => commissionSchema.parse({ ...validCommissionPayload, imageUrl: "not-a-valid-url" }),
      /Invalid image URL/
    );
  });
});
