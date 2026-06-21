import { prisma } from "./prisma";
import type { ProcessedDisco } from "@/lib/queryDiscos";
import { unstable_cache } from "next/cache";

type PromoRow = {
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
  sparkline: unknown;
};

const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

/**
 * Returns up to 40 available vinyls whose current price is ≤ R$ 200,
 * sorted best-deal-first then by discount.
 */
export async function queryPriceUnder200(): Promise<ProcessedDisco[]> {
  try {
    // Sparklines omitted: HIDE_PRICE_HISTORY=true hides them in prod, and the
    // per-row correlated subquery was causing 60s+ build timeouts as catalog grew.
    const rows = await prisma.$queryRaw<PromoRow[]>`
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
        NULL                                                             AS sparkline,
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
      WHERE  d.disponivel    = TRUE
      AND  (d.format IS NULL OR d.format = 'vinyl')
        AND  d.price_count  >= 5
        AND  hp_latest."precoBrl" >= 30
        AND  hp_latest."precoBrl" <= 200
      ORDER  BY d.deal_score DESC NULLS LAST, desconto DESC NULLS LAST
      LIMIT  600
    `;

    return rows.flatMap((row): ProcessedDisco[] => {
      const precoAtual = Number(row.precoAtual);
      const mediaPreco = Number(row.mediaPreco);
      const desconto   = Number(row.desconto);
      if (isNaN(precoAtual) || isNaN(mediaPreco) || isNaN(desconto)) return [];

      let sparkline: number[] = [];
      if (Array.isArray(row.sparkline)) {
        sparkline = (row.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
      } else if (typeof row.sparkline === "string") {
        try {
          sparkline = (JSON.parse(row.sparkline) as unknown[]).map(Number).filter((n) => !isNaN(n));
        } catch {
          sparkline = [];
        }
      }

      const rawDealScore = row.dealScore != null ? Number(row.dealScore) : null;
      const crawledAt    = row.lastCrawledAt ? new Date(row.lastCrawledAt).getTime() : null;
      const dealIsStale  = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
      const dealScore    = rawDealScore !== null && !dealIsStale ? rawDealScore : null;

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
        sparkline,
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
// 30-minute TTL fallback.
export const queryPriceUnder200WithCache = unstable_cache(
  queryPriceUnder200,
  ["price-under-200"],
  { tags: ["prices"], revalidate: 86400 },
);
