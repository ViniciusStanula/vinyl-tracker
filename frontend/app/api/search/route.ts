import { NextRequest, NextResponse } from "next/server";
import { getCachedSuggestions } from "@/lib/db/search";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

// 120 requests per IP per minute — autocomplete fires per keystroke.
const checkRateLimit = createRateLimiter(120);

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) {
    return NextResponse.json([], {
      status: 429,
      headers: { "Retry-After": String(rl.retryAfterSec) },
    });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100).trim();
  if (q.length < 3) return NextResponse.json([]);

  try {
    const results = await getCachedSuggestions(q);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
