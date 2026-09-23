interface RateLimitRecord {
  tokens: number;
  lastRefill: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

/**
 * Sliding window token bucket rate limiter.
 *
 * @param key Unique key (typically clientIp + ":" + route)
 * @param limit Maximum allowed requests within the time window
 * @param windowMs Time window in milliseconds
 * @returns Object indicating whether the request is allowed, remaining requests, and reset time
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { tokens: limit - 1, lastRefill: now };
    rateLimitStore.set(key, record);
    return { success: true, remaining: limit - 1, resetMs: windowMs };
  }

  // Refill tokens based on elapsed time
  const elapsed = now - record.lastRefill;
  if (elapsed >= windowMs) {
    record.tokens = limit - 1;
    record.lastRefill = now;
    return { success: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (record.tokens > 0) {
    record.tokens -= 1;
    const remainingTime = windowMs - elapsed;
    return { success: true, remaining: record.tokens, resetMs: remainingTime };
  }

  // Rate limit exceeded
  const resetMs = windowMs - elapsed;
  return { success: false, remaining: 0, resetMs };
}

/**
 * Helper to extract client IP address safely from standard headers.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.headers.get("x-real-ip") || "127.0.0.1";
}
