import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

interface RateLimitRecord {
  tokens: number;
  lastRefill: number;
  windowMs: number;
}

const MAX_STORE_ENTRIES = 5000;
const rateLimitStore = new Map<string, RateLimitRecord>();
let lastEvictionTime = Date.now();

/**
 * Purges expired keys from memory to prevent unbounded memory growth in long-running processes.
 */
function evictExpiredRecords() {
  const now = Date.now();
  // Only sweep at most once every 30 seconds
  if (now - lastEvictionTime < 30_000 && rateLimitStore.size < MAX_STORE_ENTRIES) {
    return;
  }

  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.lastRefill >= record.windowMs) {
      rateLimitStore.delete(key);
    }
  }

  // If still above max capacity after sweeping expired keys, remove oldest keys
  if (rateLimitStore.size > MAX_STORE_ENTRIES) {
    const keysToRemove = rateLimitStore.size - MAX_STORE_ENTRIES;
    const iterator = rateLimitStore.keys();
    for (let i = 0; i < keysToRemove; i++) {
      const k = iterator.next().value;
      if (k) rateLimitStore.delete(k);
    }
  }

  lastEvictionTime = now;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
}

/**
 * Sliding window token bucket rate limiter with bounded memory and TTL eviction.
 *
 * @param key Unique key (typically clientIp + ":" + route)
 * @param limit Maximum allowed requests within the time window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  evictExpiredRecords();

  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { tokens: limit - 1, lastRefill: now, windowMs };
    rateLimitStore.set(key, record);
    return { success: true, remaining: limit - 1, resetMs: windowMs };
  }

  // Refill tokens based on elapsed time
  const elapsed = now - record.lastRefill;
  if (elapsed >= windowMs) {
    record.tokens = limit - 1;
    record.lastRefill = now;
    record.windowMs = windowMs;
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

let upstashRatelimitInstance: Ratelimit | null = null;

function getUpstashRatelimit(): Ratelimit | null {
  if (upstashRatelimitInstance) return upstashRatelimitInstance;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    const redis = new Redis({ url, token });
    upstashRatelimitInstance = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "artfolio_rate_limit",
    });
    return upstashRatelimitInstance;
  } catch (err) {
    console.error("[UPSTASH_INIT_FAIL] Could not initialize Upstash Redis:", err);
    return null;
  }
}

/**
 * Distributed rate limiter with graceful fallback to bounded in-memory token bucket.
 * Uses Upstash Redis in serverless production and bounded in-memory storage locally.
 */
export async function checkDistributedRateLimit(
  key: string,
  limit = 5,
  windowMs = 15 * 60 * 1000
): Promise<RateLimitResult> {
  const upstash = getUpstashRatelimit();

  if (upstash) {
    try {
      const result = await upstash.limit(key);
      return {
        success: result.success,
        remaining: result.remaining,
        resetMs: result.reset - Date.now(),
      };
    } catch (redisErr) {
      console.warn("[UPSTASH_UNAVAILABLE] Redis query failed, falling back to local rate limiter:", redisErr);
    }
  }

  return checkRateLimit(key, limit, windowMs);
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
