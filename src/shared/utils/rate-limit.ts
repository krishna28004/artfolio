import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isIP } from "node:net";

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

const upstashRatelimitInstances = new Map<string, Ratelimit>();
let testLimiter: Pick<Ratelimit, "limit"> | null = null;
export function _setDistributedLimiterForTesting(limiter: Pick<Ratelimit, "limit"> | null) {
  testLimiter = limiter;
}

function getUpstashRatelimit(limit: number, windowMs: number): Ratelimit | null {

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  try {
    const redis = new Redis({ url, token });
    const cacheKey = `${limit}:${windowMs}`;
    const cached = upstashRatelimitInstances.get(cacheKey);
    if (cached) return cached;
    const instance = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${Math.max(1, Math.ceil(windowMs / 1000))} s`),
      analytics: true,
      prefix: `artfolio_rate_limit_${cacheKey}`,
    });
    upstashRatelimitInstances.set(cacheKey, instance);
    return instance;
  } catch {
    console.error("[UPSTASH_INIT_FAIL] Could not initialize Upstash Redis.");
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
  const upstash = testLimiter || getUpstashRatelimit(limit, windowMs);

  if (upstash) {
    try {
      const result = await upstash.limit(key);
      return {
        success: result.success && result.reason !== "timeout",
        remaining: result.remaining,
        resetMs: result.reset - Date.now(),
      };
    } catch {
      console.error("[UPSTASH_UNAVAILABLE] Distributed rate limit unavailable.");
      if (process.env.NODE_ENV === "production") {
        return { success: false, remaining: 0, resetMs: windowMs };
      }
    }
  }

  // A per-process limiter cannot protect a horizontally scaled production deployment.
  if (process.env.NODE_ENV === "production") return { success: false, remaining: 0, resetMs: windowMs };

  return checkRateLimit(key, limit, windowMs);
}

/**
 * Helper to extract client IP address safely from standard headers.
 */
export function getClientIp(req: Request): string {
  // The repository targets Vercel. Its platform-managed header is the source of
  // truth; a user-provided x-forwarded-for value must never take precedence.
  if (process.env.NODE_ENV === "production" && process.env.VERCEL !== "1") return "unknown";
  const vercelIp = req.headers.get("x-vercel-forwarded-for")?.trim();
  if (vercelIp && isIP(vercelIp)) return vercelIp;
  if (process.env.NODE_ENV === "production") return "unknown";
  const forwarded = req.headers.get("x-forwarded-for");
  const candidates = forwarded?.split(",").map((value) => value.trim()).filter(isIpAddress);
  return candidates?.at(-1) || "unknown";
}

function isIpAddress(value: string): boolean {
  return isIP(value) !== 0;
}
