/**
 * Money Utility for ARTfolio
 * 
 * Rules:
 * 1. Currency is exclusively Indian Rupees (INR / ₹).
 * 2. All financial values in the database, Razorpay, and APIs are stored and handled
 *    strictly as integer paise (1 Rupee = 100 Paise).
 * 3. Never use floating-point arithmetic for financial operations.
 */

/**
 * Validates whether an amount is a valid non-negative integer paise value.
 */
export function isValidPaise(amount: unknown): amount is number {
  return (
    typeof amount === "number" &&
    Number.isSafeInteger(amount) &&
    amount >= 0
  );
}

/**
 * Validates whether an amount is a positive integer paise value (> 0).
 */
export function isPositivePaise(amount: unknown): amount is number {
  return isValidPaise(amount) && amount > 0;
}

/**
 * Converts a rupee amount (number) to integer paise.
 * Throws an error for invalid, negative, NaN, or non-finite numbers.
 * 
 * Example:
 *   5000 -> 500000
 *   5000.50 -> 500050
 */
export function rupeesToPaise(rupees: number): number {
  if (typeof rupees !== "number" || !Number.isFinite(rupees) || Number.isNaN(rupees)) {
    throw new TypeError(`[MONEY_ERROR] Invalid rupee amount: ${rupees}`);
  }

  if (rupees < 0) {
    throw new RangeError(`[MONEY_ERROR] Rupee amount cannot be negative: ${rupees}`);
  }

  const str = rupees.toString();
  if (str.includes(".")) {
    const decimals = str.split(".")[1];
    if (decimals && decimals.length > 2) {
      throw new RangeError(
        `[MONEY_ERROR] Rupee amount cannot have more than two decimal places (fractional paise are invalid): ${rupees}`
      );
    }
  }

  const [wholeStr, fracStr = ""] = str.split(".");
  const whole = parseInt(wholeStr, 10);
  const frac = parseInt((fracStr + "00").slice(0, 2), 10);
  const paise = whole * 100 + frac;

  if (!Number.isSafeInteger(paise)) {
    throw new RangeError(`[MONEY_ERROR] Rupee amount exceeds safe integer limit: ${rupees}`);
  }

  return paise;
}

/**
 * Converts integer paise to rupees (floating-point number for display or calculation).
 */
export function paiseToRupees(paise: number): number {
  if (!isValidPaise(paise)) {
    throw new TypeError(`[MONEY_ERROR] Invalid paise amount: ${paise}`);
  }

  return paise / 100;
}

/**
 * Formats an integer paise amount into an Indian Rupee string with symbol (₹).
 * 
 * Examples:
 *   500000 -> "₹5,000"
 *   500050 -> "₹5,000.50"
 */
export function formatRupees(paise: number, options?: { forceDecimals?: boolean }): string {
  if (!isValidPaise(paise)) {
    return "₹0";
  }

  const rupees = paise / 100;
  const hasDecimals = paise % 100 !== 0;
  const minimumFractionDigits = options?.forceDecimals || hasDecimals ? 2 : 0;
  const maximumFractionDigits = 2;

  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(rupees);

  return `₹${formatted}`;
}
