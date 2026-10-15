/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { POST, _setRecoveryClientFactoryForTesting } from "../src/app/api/auth/recovery/verify/route.ts";

const originalAdminEmail = process.env.ADMIN_EMAIL;

afterEach(() => {
  _setRecoveryClientFactoryForTesting(null);
  if (originalAdminEmail === undefined) delete process.env.ADMIN_EMAIL;
  else process.env.ADMIN_EMAIL = originalAdminEmail;
});

function request(body: unknown, origin = "https://artfolio.test") {
  return new Request("https://artfolio.test/api/auth/recovery/verify", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("recovery verification rejects cross-origin submissions before contacting Auth", async () => {
  let called = false;
  _setRecoveryClientFactoryForTesting(async () => {
    called = true;
    throw new Error("Auth must not be contacted");
  });

  const response = await POST(request({ email: "owner@example.com", token: "12345678" }, "https://attacker.test"));
  assert.equal(response.status, 403);
  assert.equal(called, false);
  assert.equal(response.headers.get("cache-control"), "no-store, private");
});

test("recovery verification rejects malformed codes before contacting Auth", async () => {
  let called = false;
  _setRecoveryClientFactoryForTesting(async () => {
    called = true;
    throw new Error("Auth must not be contacted");
  });

  const response = await POST(request({ email: "owner@example.com", token: "not-a-code" }));
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("invalid recovery codes do not expose Auth provider details", async () => {
  process.env.ADMIN_EMAIL = "owner@example.com";
  _setRecoveryClientFactoryForTesting(async () => ({
    auth: {
      verifyOtp: async () => ({ data: { user: null }, error: { message: "sensitive provider detail" } }),
      signOut: async () => ({ error: null }),
    },
  } as any));

  const response = await POST(request({ email: "owner@example.com", token: "12345678" }));
  const body = await response.json();
  assert.equal(response.status, 400);
  assert.match(body.message, /invalid, expired, or already used/i);
  assert.doesNotMatch(JSON.stringify(body), /sensitive provider detail/);
});

test("only the configured confirmed curator can establish a recovery session", async () => {
  process.env.ADMIN_EMAIL = "Owner@Example.com";
  let verified: unknown;
  let signedOut = false;
  _setRecoveryClientFactoryForTesting(async () => ({
    auth: {
      verifyOtp: async (input: unknown) => {
        verified = input;
        return { data: { user: { email: "owner@example.com", email_confirmed_at: "2026-01-01T00:00:00.000Z" } }, error: null };
      },
      signOut: async () => { signedOut = true; return { error: null }; },
    },
  } as any));

  const response = await POST(request({ email: "owner@example.com", token: "12345678" }));
  assert.equal(response.status, 200);
  assert.deepEqual(verified, { email: "owner@example.com", token: "12345678", type: "recovery" });
  assert.equal(signedOut, false);
});

test("a valid code for a non-owner account is signed out", async () => {
  process.env.ADMIN_EMAIL = "owner@example.com";
  let signedOut = false;
  _setRecoveryClientFactoryForTesting(async () => ({
    auth: {
      verifyOtp: async () => ({ data: { user: { email: "other@example.com", email_confirmed_at: "2026-01-01T00:00:00.000Z" } }, error: null }),
      signOut: async () => { signedOut = true; return { error: null }; },
    },
  } as any));

  const response = await POST(request({ email: "other@example.com", token: "12345678" }));
  assert.equal(response.status, 403);
  assert.equal(signedOut, true);
});
