import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { queryDiscos } from "@/lib/queryDiscos";

const ALLOWED_SORTS = new Set(["desconto", "menor-preco", "maior-preco", "avaliados", "az", "deals"]);

const getCachedDiscos = unstable_cache(
  (params: Parameters<typeof queryDiscos>[0]) => queryDiscos(params),
  ["discos-query"],
  { tags: ["prices"], revalidate: 3600 }
);

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const q           = (sp.get("q") ?? "").slice(0, 200);
  const sortRaw     = sp.get("sort") ?? "desconto";
  const sort        = ALLOWED_SORTS.has(sortRaw) ? sortRaw : "desconto";
  const artista     = sp.get("artista") || undefined;
  const page        = Math.max(1, parseInt(sp.get("page") ?? "1", 10));
  const precoMaxStr = sp.get("precoMax");
  const precoMax    = precoMaxStr ? Number(precoMaxStr) : null;

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
