import Razorpay from "razorpay";

let razorpayInstance: Razorpay | null = null;

/**
 * Returns the authenticated Razorpay client instance.
 * Throws a descriptive error if server credentials are not configured.
 */
export function getRazorpayClient(): Razorpay {
  if (razorpayInstance) return razorpayInstance;

  const key_id = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_SECRET;

  if (!key_id || !key_secret) {
    throw new Error(
      "[RAZORPAY_FATAL] Missing RAZORPAY_KEY_ID or RAZORPAY_SECRET environment variables. " +
      "Please configure them in your server environment."
    );
  }

  razorpayInstance = new Razorpay({ key_id, key_secret });
  return razorpayInstance;
}

/**
 * Lazy proxy to preserve existing callers importing `razorpay` directly.
 */
export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    const client = getRazorpayClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const val = (client as any)[prop];
    if (typeof val === "function") {
      return val.bind(client);
    }
    return val;
  },
});
