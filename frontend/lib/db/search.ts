import { prisma } from "@/lib/db/prisma";
import { unstable_cache } from "next/cache";

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
      AND  (format IS NULL OR format = 'vinyl')
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

const _getCachedSuggestions = unstable_cache(
  fetchSuggestions,
  ["search-suggestions"],
  { tags: ["prices"], revalidate: 3600 }
);

export const getCachedSuggestions = (q: string) => _getCachedSuggestions(q);
