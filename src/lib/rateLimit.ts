// Simple in-memory sliding-window rate limiter.
//
// CAVEAT: this state lives in the Node process's memory. It works
// correctly as long as the app runs on a single, persistent Node server
// (e.g. `next start` on a VM/container). If you deploy to a serverless
// platform that spins up multiple/ephemeral instances (Vercel functions,
// AWS Lambda, etc.), each instance gets its own counters, so the *actual*
// limit becomes "N times whatever number of warm instances exist" rather
// than a hard global limit. That's still strictly better than no limit at
// all, but if this app starts seeing real abuse on serverless, swap this
// for a shared store (e.g. Upstash Redis) instead.

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

// Periodically forget old buckets so this Map doesn't grow forever.
const MAX_BUCKETS = 5000;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * @param key Unique identifier for the thing being limited, e.g.
 *   `login:${ip}`. Prefix by route so different endpoints don't share a
 *   budget.
 * @param limit Max requests allowed per window.
 * @param windowSeconds Length of the sliding window, in seconds.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  if (buckets.size > MAX_BUCKETS) {
    // Cheap safety valve — drop everything rather than leak memory
    // indefinitely. Worst case, some clients get an extra request or two.
    buckets.clear();
  }

  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterSeconds = Math.ceil(
      (existing.windowStart + windowMs - now) / 1000
    );
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds: 0,
  };
}

/** Best-effort client IP extraction behind a proxy/load balancer. */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}
