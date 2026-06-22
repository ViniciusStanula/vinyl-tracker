import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { detectBot } from "@/lib/bots";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.garimpavinil.com.br";

function addCanonical(res: NextResponse, pathname: string, searchParams: URLSearchParams): NextResponse {
  if (!pathname.startsWith("/api/")) {
    const pageParam = searchParams.get("page");
    const page = pageParam ? parseInt(pageParam, 10) : 1;
    const canonicalPath = page > 1 ? `${pathname}?page=${page}` : pathname;
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

  // Fire-and-forget: runs after the response is sent, never delays TTFB.
  // "Prefer: return=minimal" is required — the anon role has no SELECT on
  // bot_hits, so asking PostgREST to return the row would fail the insert.
  after(async () => {
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
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      console.error("[bot-log] insert failed:", err);
    }
  });

  return addCanonical(NextResponse.next(), pathname, request.nextUrl.searchParams);
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
