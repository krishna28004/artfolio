import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { computeHmacSha256, timingSafeEqualStr } from "../src/shared/utils/crypto.ts";
import { isValidPaise } from "../src/shared/utils/money.ts";

/**
 * Pure deterministic validation models representing the backend financial rules
 * in /api/payment/verify and /api/payment/webhook.
 */

interface MockCommission {
  id: string;
  price: number; // in integer paise
  status: "pending" | "approved" | "payment_pending" | "paid" | "fulfilled" | "expired" | "cancelled";
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  expires_at: string | null;
}

function processPaymentVerification(params: {
  commissionId: string;
  submittedOrderId: string;
  submittedPaymentId: string;
  submittedSignature: string;
  secret: string;
  commission: MockCommission | null;
}): { success: boolean; status: number; message: string } {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.commissionId)) {
    return { success: false, status: 400, message: "Invalid commission UUID format." };
  }

  // 1. Signature Verification
  const expectedSig = computeHmacSha256(
    `${params.submittedOrderId}|${params.submittedPaymentId}`,
    params.secret
  );

  if (!timingSafeEqualStr(expectedSig, params.submittedSignature)) {
    return { success: false, status: 400, message: "Invalid payment signature. Verification rejected." };
  }

  // 2. Commission Record Lookup
  if (!params.commission) {
    return { success: false, status: 404, message: "Commission record not found." };
  }

  // 3. Expiration Check
  if (params.commission.expires_at && new Date() > new Date(params.commission.expires_at)) {
    return { success: false, status: 410, message: "Commission acquisition window has expired." };
  }

  // 4. Order ID Association Cross-Check
  if (params.commission.razorpay_order_id && params.commission.razorpay_order_id !== params.submittedOrderId) {
    return { success: false, status: 400, message: "Payment does not correspond to the approved order." };
  }

  // 5. Idempotency: Already Paid
  if (params.commission.status === "paid" || params.commission.status === "fulfilled") {
    return { success: true, status: 200, message: "Payment previously verified and recorded." };
  }

  // 6. Valid Status Progression Check
  if (params.commission.status !== "approved" && params.commission.status !== "payment_pending") {
    return {
      success: false,
      status: 400,
      message: `Cannot verify payment for commission in '${params.commission.status}' state.`,
    };
  }

  // 7. Success
  return { success: true, status: 200, message: "Payment verified successfully." };
}

function processWebhookCaptured(params: {
  rawBody: string;
  signature: string;
  secret: string;
  commission: MockCommission | null;
}): { success: boolean; status: number; message: string } {
  // 1. Webhook Signature Verification
  const expectedSig = computeHmacSha256(params.rawBody, params.secret);
  if (!timingSafeEqualStr(expectedSig, params.signature)) {
    return { success: false, status: 401, message: "Unauthorized: Webhook signature verification failed." };
  }

  const event = JSON.parse(params.rawBody);
  if (event.event !== "payment.captured") {
    return { success: true, status: 200, message: "Ignored event." };
  }

  const payment = event.payload?.payment?.entity;
  if (!payment) {
    return { success: false, status: 400, message: "Malformed payment payload." };
  }

  // 2. Commission Lookup
  if (!params.commission) {
    return { success: true, status: 200, message: "Commission record not found for order." };
  }

  // 3. Idempotency Check
  if (params.commission.status === "paid" || params.commission.status === "fulfilled") {
    return { success: true, status: 200, message: "Payment already processed and recorded." };
  }

  // 4. Strict Currency Verification
  if (payment.currency !== "INR") {
    return { success: false, status: 400, message: "Invalid payment currency." };
  }

  // 5. Strict Amount Verification (Exact Paise Match)
  if (!isValidPaise(payment.amount) || payment.amount !== params.commission.price) {
    return { success: false, status: 400, message: "Payment amount does not match approved quote." };
  }

  return { success: true, status: 200, message: "Payment recorded successfully." };
}

describe("Payment & Financial Security Logic Tests", () => {
  const secret = "test_razorpay_secret_key_987654";
  const commissionId = "123e4567-e89b-12d3-a456-426614174000";
  const orderId = "order_O123456789";
  const paymentId = "pay_P123456789";
  const validSignature = computeHmacSha256(`${orderId}|${paymentId}`, secret);

  const baseCommission: MockCommission = {
    id: commissionId,
    price: 500000, // ₹5,000 in integer paise
    status: "payment_pending",
    razorpay_order_id: orderId,
    razorpay_payment_id: null,
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };

  describe("Client Payment Verification (/api/payment/verify)", () => {
    test("valid payment verification succeeds", () => {
      const result = processPaymentVerification({
        commissionId,
        submittedOrderId: orderId,
        submittedPaymentId: paymentId,
        submittedSignature: validSignature,
        secret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
    });

    test("wrong signature is rejected with 400", () => {
      const result = processPaymentVerification({
        commissionId,
        submittedOrderId: orderId,
        submittedPaymentId: paymentId,
        submittedSignature: "forged_signature_00000000000000000000000000000000",
        secret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.match(result.message, /Invalid payment signature/);
    });

    test("wrong order ID (mismatched database order) is rejected with 400", () => {
      const mismatchOrderId = "order_DIFFERENT_999";
      const sig = computeHmacSha256(`${mismatchOrderId}|${paymentId}`, secret);

      const result = processPaymentVerification({
        commissionId,
        submittedOrderId: mismatchOrderId,
        submittedPaymentId: paymentId,
        submittedSignature: sig,
        secret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.match(result.message, /Payment does not correspond to the approved order/);
    });

    test("invalid commission ID format (non-UUID) is rejected with 400", () => {
      const result = processPaymentVerification({
        commissionId: "not-a-valid-uuid",
        submittedOrderId: orderId,
        submittedPaymentId: paymentId,
        submittedSignature: validSignature,
        secret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.match(result.message, /Invalid commission UUID format/);
    });

    test("expired commission is rejected with 410", () => {
      const expiredCommission: MockCommission = {
        ...baseCommission,
        expires_at: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
      };

      const result = processPaymentVerification({
        commissionId,
        submittedOrderId: orderId,
        submittedPaymentId: paymentId,
        submittedSignature: validSignature,
        secret,
        commission: expiredCommission,
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 410);
      assert.match(result.message, /acquisition window has expired/);
    });

    test("already-paid commission returns idempotent 200 without error or re-charging", () => {
      const paidCommission: MockCommission = {
        ...baseCommission,
        status: "paid",
        razorpay_payment_id: paymentId,
      };

      const result = processPaymentVerification({
        commissionId,
        submittedOrderId: orderId,
        submittedPaymentId: paymentId,
        submittedSignature: validSignature,
        secret,
        commission: paidCommission,
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
      assert.match(result.message, /previously verified/);
    });

    test("commission in invalid state (e.g. pending without approval) is rejected", () => {
      const pendingCommission: MockCommission = {
        ...baseCommission,
        status: "pending",
      };

      const result = processPaymentVerification({
        commissionId,
        submittedOrderId: orderId,
        submittedPaymentId: paymentId,
        submittedSignature: validSignature,
        secret,
        commission: pendingCommission,
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.match(result.message, /Cannot verify payment for commission in 'pending' state/);
    });
  });

  describe("Razorpay Webhook (/api/payment/webhook)", () => {
    const webhookSecret = "test_webhook_secret_xyz123";

    function makeWebhookPayload(amount: number, currency: string = "INR") {
      return JSON.stringify({
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: paymentId,
              order_id: orderId,
              amount, // in paise
              currency,
              status: "captured",
            },
          },
        },
      });
    }

    test("valid webhook with exact amount and currency succeeds", () => {
      const rawBody = makeWebhookPayload(500000, "INR");
      const sig = computeHmacSha256(rawBody, webhookSecret);

      const result = processWebhookCaptured({
        rawBody,
        signature: sig,
        secret: webhookSecret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
      assert.match(result.message, /recorded successfully/);
    });

    test("webhook with forged or tampered signature is rejected with 401", () => {
      const rawBody = makeWebhookPayload(500000, "INR");

      const result = processWebhookCaptured({
        rawBody,
        signature: "tampered_signature_hex_12345",
        secret: webhookSecret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 401);
      assert.match(result.message, /signature verification failed/);
    });

    test("webhook with WRONG AMOUNT (e.g. 5000 paise instead of 500000) is REJECTED with 400", () => {
      // Attacker tried to pay ₹50 instead of ₹5,000
      const rawBody = makeWebhookPayload(5000, "INR");
      const sig = computeHmacSha256(rawBody, webhookSecret);

      const result = processWebhookCaptured({
        rawBody,
        signature: sig,
        secret: webhookSecret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.match(result.message, /Payment amount does not match/);
    });

    test("webhook with WRONG CURRENCY (e.g. USD instead of INR) is REJECTED with 400", () => {
      const rawBody = makeWebhookPayload(500000, "USD");
      const sig = computeHmacSha256(rawBody, webhookSecret);

      const result = processWebhookCaptured({
        rawBody,
        signature: sig,
        secret: webhookSecret,
        commission: { ...baseCommission },
      });
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 400);
      assert.match(result.message, /Invalid payment currency/);
    });

    test("duplicate webhook on already-paid commission is idempotent 200 without duplicate update", () => {
      const rawBody = makeWebhookPayload(500000, "INR");
      const sig = computeHmacSha256(rawBody, webhookSecret);

      const alreadyPaidCommission: MockCommission = {
        ...baseCommission,
        status: "paid",
        razorpay_payment_id: paymentId,
      };

      const result = processWebhookCaptured({
        rawBody,
        signature: sig,
        secret: webhookSecret,
        commission: alreadyPaidCommission,
      });
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 200);
      assert.match(result.message, /Payment already processed/);
    });
  });
});
