import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { challengeMatches, commissionChallengeDigest, createCommissionVerification, readCommissionVerification } from "../src/features/commission/server/email-verification.ts";
import { consumeCommissionChallenge } from "../src/features/commission/server/email-challenge-store.ts";
import { POST as sendEmail } from "../src/app/api/commission/email/send/route.ts";
import { POST as verifyEmail } from "../src/app/api/commission/email/verify/route.ts";
import { POST as endVerification } from "../src/app/api/commission/email/end/route.ts";

test("commission email proof expires after one hour and rejects tampering", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role-key";
  try {
    const now = 1_700_000_000_000;
    const marker = createCommissionVerification("patron@example.com", now);
    assert.ok(marker);
    assert.equal(readCommissionVerification(marker, now + 59 * 60_000), "patron@example.com");
    assert.equal(readCommissionVerification(marker, now + 60 * 60_000), null);
    assert.equal(readCommissionVerification(marker!.replace(/.$/, "x"), now), null);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});

test("email challenge hash is bound to challenge, address and code", () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role-key";
  try {
    const digest = commissionChallengeDigest("challenge-a", "patron@example.com", "123456");
    assert.equal(challengeMatches(digest, commissionChallengeDigest("challenge-a", "patron@example.com", "123456")), true);
    assert.equal(challengeMatches(digest, commissionChallengeDigest("challenge-b", "patron@example.com", "123456")), false);
    assert.equal(challengeMatches(digest, commissionChallengeDigest("challenge-a", "other@example.com", "123456")), false);
    assert.equal(challengeMatches(digest, commissionChallengeDigest("challenge-a", "patron@example.com", "654321")), false);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});

test("email code is consumed once, including after an incorrect attempt", async () => {
  const previous = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only-service-role-key";
  try {
    const records = new Map<string, string>();
    const store = { getdel: async <T>(key: string): Promise<T | null> => {
      const value = records.get(key) || null;
      records.delete(key);
      return value as T | null;
    } };
    const challenge = "5d9ad46e-2e9c-499c-bdfa-7f8665866840";
    records.set(`artfolio:commission:email-code:${challenge}`, commissionChallengeDigest(challenge, "patron@example.com", "123456")!);
    assert.equal(await consumeCommissionChallenge(store, challenge, "patron@example.com", "123456"), true);
    assert.equal(await consumeCommissionChallenge(store, challenge, "patron@example.com", "123456"), false);
    records.set(`artfolio:commission:email-code:${challenge}`, commissionChallengeDigest(challenge, "patron@example.com", "123456")!);
    assert.equal(await consumeCommissionChallenge(store, challenge, "patron@example.com", "999999"), false);
    assert.equal(await consumeCommissionChallenge(store, challenge, "patron@example.com", "123456"), false);
  } finally {
    if (previous === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previous;
  }
});

test("commission email endpoints reject cross-origin and malformed requests before providers", async () => {
  const foreign = await sendEmail(new NextRequest("https://artfolio.test/api/commission/email/send", {
    method: "POST", headers: { origin: "https://foreign.test", "content-type": "application/json" },
    body: JSON.stringify({ email: "patron@example.com" }),
  }));
  assert.equal(foreign.status, 403);

  const malformed = await verifyEmail(new NextRequest("https://artfolio.test/api/commission/email/verify", {
    method: "POST", headers: { origin: "https://artfolio.test", "content-type": "application/json" },
    body: JSON.stringify({ email: "patron@example.com", code: "not-a-code", challengeId: "wrong" }),
  }));
  assert.equal(malformed.status, 400);
});

test("ending commission verification clears the scoped access cookie", async () => {
  const response = await endVerification(new NextRequest("https://artfolio.test/api/commission/email/end", {
    method: "POST", headers: { origin: "https://artfolio.test" },
  }));
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") || "", /artfolio-commission-verified=;/);
});
