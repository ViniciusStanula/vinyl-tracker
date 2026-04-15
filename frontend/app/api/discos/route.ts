import { NextRequest, NextResponse } from "next/server";
import { queryDiscos } from "@/lib/queryDiscos";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;

  const q           = sp.get("q") ?? "";
  const sort        = sp.get("sort") ?? "desconto";
  const artista     = sp.get("artista") || undefined; // '' → undefined
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
