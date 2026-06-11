import type { NextRequest } from "next/server";

// Module-level sliding window — scoped to the warm Vercel instance.
// Not cross-instance-safe, but stops naive scrapers and runaway agents.

type Entry = { count: number; resetAt: number };

export type RateLimitResult = { allowed: boolean; retryAfterSec: number };

export function createRateLimiter(maxPerWindow: number, windowMs = 60_000) {
  const store = new Map<string, Entry>();

  return function check(ip: string): RateLimitResult {
    const now = Date.now();

    // Prune stale entries when store grows large
    if (store.size > 500) {
      for (const [k, v] of store) if (now > v.resetAt) store.delete(k);
    }

    const entry = store.get(ip);
    if (!entry || now > entry.resetAt) {
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    if (entry.count >= maxPerWindow) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count++;
    return { allowed: true, retryAfterSec: 0 };
  };
}

export function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}
