import { prisma } from "./prisma";
import type { ProcessedDisco } from "@/lib/queryDiscos";
import { unstable_cache } from "next/cache";

type OfertaRow = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: string | null;
  reviewCount: string | null;
  dealScore: number | null;
  confidenceLevel: string | null;
  lastCrawledAt: Date | null;
  lastfmTags: string | null;
  precoAtual: string;
  mediaPreco: string;
  desconto: string;
};

// Deals older than this are considered stale and excluded — matches the
// frontend's existing 4h deal-freshness window used elsewhere (DiscoCard).
const DEAL_FRESH_HOURS = 4;

/**
 * Returns currently-active deal-tier vinyls (deal_score 1-3), freshest prices
 * only, ordered by tier then discount. Tier is preserved so the page can group
 * them: 3 = Melhor Preço, 2 = Ótima Oferta, 1 = Boa Oferta.
 */
export async function queryOfertas(): Promise<ProcessedDisco[]> {
  try {
    const rows = await prisma.$queryRaw<OfertaRow[]>`
      SELECT
        d.id,
        d.titulo,
        d.artista,
        d.slug,
        d.estilo,
        d."imgUrl",
        d.url,
        d.rating::text                                                   AS rating,
        d."reviewCount"::text                                            AS "reviewCount",
        d.deal_score                                                     AS "dealScore",
        d.confidence_level                                               AS "confidenceLevel",
        d.last_crawled_at                                                AS "lastCrawledAt",
        d.lastfm_tags                                                    AS "lastfmTags",
        hp_latest."precoBrl"                                             AS "precoAtual",
        COALESCE(d.avg_30d::float, hp_latest."precoBrl")                 AS "mediaPreco",
        CASE
          WHEN COALESCE(d.avg_30d::float, hp_latest."precoBrl") > 0
          THEN (COALESCE(d.avg_30d::float, hp_latest."precoBrl") - hp_latest."precoBrl")
             / COALESCE(d.avg_30d::float, hp_latest."precoBrl")
          ELSE 0
        END                                                              AS desconto
      FROM   "Disco" d
      INNER JOIN LATERAL (
        SELECT "precoBrl"
        FROM   "HistoricoPreco"
        WHERE  "discoId" = d.id
        ORDER  BY "capturadoEm" DESC
        LIMIT  1
      ) hp_latest ON true
      WHERE  d.disponivel     = TRUE
        AND  (d.format IS NULL OR d.format = 'vinyl')
        AND  d.deal_score IS NOT NULL
        AND  d.last_crawled_at > NOW() - (${DEAL_FRESH_HOURS} * INTERVAL '1 hour')
        AND  hp_latest."precoBrl" >= 30
      ORDER  BY d.deal_score DESC, desconto DESC NULLS LAST
      LIMIT  600
    `;

    return rows.flatMap((row): ProcessedDisco[] => {
      const precoAtual = Number(row.precoAtual);
      const mediaPreco = Number(row.mediaPreco);
      const desconto   = Number(row.desconto);
      if (isNaN(precoAtual) || isNaN(mediaPreco) || isNaN(desconto)) return [];

      const dealScore = row.dealScore != null ? Number(row.dealScore) : null;

      return [{
        id:              row.id,
        slug:            row.slug,
        titulo:          row.titulo,
        artista:         row.artista,
        estilo:          row.estilo,
        imgUrl:          row.imgUrl,
        url:             row.url,
        rating:          row.rating != null ? Number(row.rating) : null,
        reviewCount:     row.reviewCount != null ? Number(row.reviewCount) : null,
        precoAtual,
        mediaPreco,
        emPromocao:      dealScore !== null,
        desconto,
        sparkline:       [],
        dealScore,
        confidenceLevel: row.confidenceLevel ?? null,
        historyDays:     null,
        lastfmTags:      row.lastfmTags ?? null,
      }];
    });
  } catch {
    return [];
  }
}

// Cached under `prices` tag — invalidated by the crawler webhook after each run.
export const queryOfertasWithCache = unstable_cache(
  queryOfertas,
  ["ofertas-by-tier"],
  { tags: ["prices"], revalidate: 86400 },
);
