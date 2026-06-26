// Next 16 renamed Middleware -> Proxy. The deprecated `middleware.ts` name still
// compiled (build showed "ƒ Proxy (Middleware)") but Vercel's Next 16.2.9 runtime
// never invoked the shimmed function in prod: no x-grmp-proxy header and no
// bot_hits rows except local-dev (::1). Switched to the documented `proxy.ts` +
// `export function proxy` convention (nodejs runtime) per the build's own
// deprecation warning.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { detectBot } from "@/lib/bots";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garimpavinil.com.br";

function addCanonical(res: NextResponse, pathname: string, searchParams: URLSearchParams): NextResponse {
  if (!pathname.startsWith("/api/")) {
    const pageParam = searchParams.get("page");
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const canonicalPath = page > 1 ? `${pathname}?page=${page}` : pathname === "/" ? "" : pathname;
    res.headers.set("Link", `<${SITE_URL}${canonicalPath}>; rel="canonical"`);
  }
  return res;
}

export async function proxy(request: NextRequest) {
  // Block high-volume bot traffic from SG/CN/MY when the request has no
  // Portuguese Accept-Language — confirmed via GA4 (0% engagement).
  // Legitimate PT-BR speakers in those countries still pass through.
  const country = request.headers.get("x-vercel-ip-country") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  if (
    (country === "SG" || country === "CN" || country === "MY") &&
    !lang.toLowerCase().includes("pt")
  ) {
    return new Response("", { status: 403 });
  }

  const pathname = request.nextUrl.pathname;
  const ua = request.headers.get("user-agent") ?? "";
  const isMcp = pathname.startsWith("/api/mcp");
  const bot = detectBot(ua);

  // noindex for thin artista/estilo pages is handled by the page's own
  // <meta name="robots"> tag (same thresholds). No serial pre-flight needed.

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // misconfig must never break pages

  // Snapshot request data now — the request object should not be touched
  // after the response is sent.
  const row = {
    path: pathname,
    query: request.nextUrl.search || null,
    user_agent: ua.slice(0, 512),
    bot_name: bot?.name ?? null,
    bot_category: bot?.category ?? null,
    method: request.method,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    country: request.headers.get("x-vercel-ip-country"),
    region: request.headers.get("x-vercel-ip-region"),
    city: request.headers.get("x-vercel-ip-city"),
    referer: request.headers.get("referer"),
    accept_language: request.headers.get("accept-language")?.slice(0, 40) ?? null,
  };

  // Only log recognised bots — human browsers add row volume with no signal.
  // null bot = regular visitor, skip. MCP path always has bot set (mcp_client).
  if (bot) {
    // Awaited, not fire-and-forget: after()/waitUntil does not flush for
    // pass-through (NextResponse.next()) proxy responses on Vercel, so every
    // prod bot hit was silently dropped. Bots are low-volume and don't need
    // sub-ms TTFB; the 3 s timeout bounds the wait so a Supabase cold start
    // drops the log rather than hanging the crawler.
    // "Prefer: return=minimal" is required — the anon role has no SELECT on
    // bot_hits, so asking PostgREST to return the row would fail the insert.
    try {
      await fetch(`${url}/rest/v1/bot_hits`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      console.error("[bot-log] insert failed:", err);
    }
  }

  const res = addCanonical(NextResponse.next(), pathname, request.nextUrl.searchParams);
  // TEMP diagnostic — confirms the proxy executes in prod and what it detected.
  res.headers.set("x-grmp-proxy", bot?.name ?? "ran");
  return res;
}

export const config = {
  matcher: [
    {
      // All page routes + robots.txt, sitemap.xml, /sitemap/*.xml, llms.txt,
      // llms-full.txt. Excludes: all /api/* (except /api/mcp below), _next
      // internals, and static assets. The "missing" conditions skip proxy
      // invocations for Next.js client prefetches — bots don't prefetch.
      source:
        "/((?!api/|_next/|.*\\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|otf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    // MCP agent traffic is logged regardless of user-agent.
    { source: "/api/mcp/:path*" },
  ],
};
