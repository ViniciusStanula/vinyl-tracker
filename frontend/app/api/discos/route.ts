import { NextRequest, NextResponse } from "next/server";
import { queryDiscos } from "@/lib/queryDiscos";

const ALLOWED_SORTS = new Set(["desconto", "menor-preco", "maior-preco", "avaliados", "az", "deals"]);

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
    const { items, total, totalPages } = await queryDiscos({
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
