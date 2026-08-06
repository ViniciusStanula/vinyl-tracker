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
  const bot = detectBot(ua);

  // meta-externalagent ignores `Disallow: /*_rsc=` in robots.txt: 255,288 of its
  // 286,878 hits in the last 30 days were ?_rsc= fetches (bot_hits). Those return
  // the RSC payload for HTML it has already crawled — no content it doesn't have,
  // one serverless invocation each. Blocking the param leaves its 31,590 HTML
  // fetches untouched, so its view of the site is unchanged. Real browser
  // prefetches never reach here (the matcher's `missing` conditions exclude them).
  if (
    request.nextUrl.searchParams.has("_rsc") &&
    ua.toLowerCase().includes("meta-externalagent")
  ) {
    return new Response("", { status: 403 });
  }

  // noindex for thin artista/estilo pages is handled by the page's own
  // <meta name="robots"> tag (same thresholds). No serial pre-flight needed.

  // Bot logging moved to the Vercel Log Drain → /api/log-drain path, which
  // captures ALL traffic (this proxy was never invoked in prod anyway). The
  // old synchronous bot_hits insert here — awaited, 3 s timeout — would have
  // added its full latency to every bot request, including edge-cache HITs,
  // if Vercel ever started invoking the proxy. Removed for that reason.

  const res = addCanonical(NextResponse.next(), pathname, request.nextUrl.searchParams);
  // TEMP diagnostic — confirms the proxy executes in prod and what it detected.
  res.headers.set("x-grmp-proxy", bot?.name ?? "ran");
  return res;
}

export const config = {
  matcher: [
    {
      // All page routes + robots.txt, sitemap.xml, /sitemap/*.xml, llms.txt,
      // llms-full.txt. Excludes: all /api/*, _next internals, and static
      // assets. The "missing" conditions skip proxy invocations for Next.js
      // client prefetches — bots don't prefetch.
      source:
        "/((?!api/|_next/|.*\\.(?:jpg|jpeg|png|gif|webp|avif|svg|ico|css|js|mjs|map|woff2?|ttf|otf)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
