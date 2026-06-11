import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { queryDiscos } from "@/lib/queryDiscos";
import { createRateLimiter, clientIp } from "@/lib/rateLimit";

const ALLOWED_SORTS = new Set(["desconto", "menor-preco", "maior-preco", "avaliados", "az", "deals"]);

// 60 requests per IP per minute — generous for the infinite grid, stops scrapers.
const checkRateLimit = createRateLimiter(60);

const getCachedDiscos = unstable_cache(
  (params: Parameters<typeof queryDiscos>[0]) => queryDiscos(params),
  ["discos-query"],
  { tags: ["prices"], revalidate: 3600 }
);

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(clientIp(req));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const sp = req.nextUrl.searchParams;

  const q           = (sp.get("q") ?? "").slice(0, 200);
  const sortRaw     = sp.get("sort") ?? "desconto";
  const sort        = ALLOWED_SORTS.has(sortRaw) ? sortRaw : "desconto";
  const artista     = sp.get("artista") || undefined;
  // parseInt("abc") is NaN and Math.max(1, NaN) is NaN, which would reach the
  // SQL OFFSET and throw — sanitize to finite, positive values or fall back.
  const pageRaw     = parseInt(sp.get("page") ?? "1", 10);
  const page        = Number.isFinite(pageRaw) ? Math.max(1, pageRaw) : 1;
  const precoMaxStr = sp.get("precoMax");
  const precoMaxRaw = precoMaxStr ? Number(precoMaxStr) : NaN;
  const precoMax    = Number.isFinite(precoMaxRaw) && precoMaxRaw > 0 ? precoMaxRaw : null;

  try {
    const { items, total, totalPages } = await getCachedDiscos({
      searchTerm: q.trim(),
      sort,
      artista,
      precoMax,
      page,
    });
    return NextResponse.json({ items, total, totalPages, currentPage: page });
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao buscar discos" },
      { status: 500 }
    );
  }
}
