import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type SearchSuggestion = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  imgUrl: string | null;
  preco: number | null;
};

function buildTsQuery(term: string): string | null {
  const words = term
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/[^a-zA-Z0-9À-ɏ]/g, ""))
    .filter(w => w.length > 0);
  if (words.length === 0) return null;
  return words.map(w => `${w}:*`).join(" & ");
}

async function fetchSuggestions(q: string): Promise<SearchSuggestion[]> {
  const tsq = buildTsQuery(q);
  if (!tsq) return [];

  try {
    const rows = await prisma.$queryRaw<{
      id: string;
      titulo: string;
      artista: string;
      slug: string;
      imgUrl: string | null;
      preco: string | null;
    }[]>`
      SELECT
        id,
        titulo,
        artista,
        slug,
        "imgUrl",
        avg_30d::text AS preco
      FROM "Disco"
      WHERE disponivel = TRUE
        AND price_count >= 5
        AND search_vector @@ to_tsquery('simple', ${tsq})
      ORDER BY
        ts_rank(search_vector, to_tsquery('simple', ${tsq})) DESC,
        avg_30d DESC NULLS LAST
      LIMIT 8
    `;

    return rows.map(r => ({
      id: r.id,
      titulo: r.titulo,
      artista: r.artista,
      slug: r.slug,
      imgUrl: r.imgUrl,
      preco: r.preco !== null ? Number(r.preco) : null,
    }));
  } catch {
    return [];
  }
}

const getCachedSuggestions = (q: string) =>
  unstable_cache(
    () => fetchSuggestions(q),
    ["search-suggestions", q],
    { tags: ["prices"], revalidate: 60 }
  )();

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 100).trim();
  if (q.length < 2) return NextResponse.json([]);

  try {
    const results = await getCachedSuggestions(q);
    return NextResponse.json(results, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json([]);
  }
}
