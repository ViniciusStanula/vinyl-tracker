import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export const PAGE_SIZE = 24;

type Sort = "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

/** Escape LIKE meta-characters in user-supplied text. */
function likePct(term: string): string {
  return `%${term.replace(/[%_\\]/g, "\\$&")}%`;
}

function buildOrderBy(sort: string): Prisma.Sql {
  switch (sort as Sort) {
    case "menor-preco": return Prisma.sql`"precoAtual" ASC`;
    case "maior-preco": return Prisma.sql`"precoAtual" DESC`;
    case "avaliados":   return Prisma.sql`COALESCE(rating::numeric, 0) DESC`;
    case "az":          return Prisma.sql`titulo ASC`;
    case "desconto":
    default:            return Prisma.sql`desconto DESC NULLS LAST, COALESCE("reviewCount", 0) DESC`;
  }
}

type DiscoRow = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: string | null;
  reviewCount: string | null;
  precoAtual: string;
  mediaPreco: string;
  totalPrecos: string;
  desconto: string;
  sparkline: unknown; // json_agg → JS array or string depending on pg driver version
  dealScore: string | null;        // SMALLINT from Disco.deal_score
  confidenceLevel: string | null;  // VARCHAR from Disco.confidence_level
  historyDays: string | null;      // INTEGER from Disco.history_days
  lastCrawledAt: Date | null;      // TIMESTAMPTZ from Disco.last_crawled_at
};

export type ProcessedDisco = {
  id: string;
  slug: string;
  titulo: string;
  artista: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: number | null;
  reviewCount: number | null;
  precoAtual: number;
  mediaPreco: number;
  emPromocao: boolean;
  desconto: number;
  sparkline: number[];
  /** Scoring tier: 1 = Boa Oferta, 2 = Ótima Oferta, 3 = Melhor Preço, null = no deal */
  dealScore: number | null;
  /** Backend confidence tier identifier; use CONFIDENCE_LABELS in the frontend for display */
  confidenceLevel: string | null;
  /** Days of price history available (used to render trust indicators) */
  historyDays: number | null;
};

export async function queryDiscos(params: {
  searchTerm: string;
  sort: string;
  artista?: string;
  precoMax: number | null;
  page: number;
}): Promise<{ items: ProcessedDisco[]; total: number; totalPages: number }> {
  const { searchTerm, sort, artista, precoMax, page } = params;

  const whereSearch = searchTerm
    ? Prisma.sql`AND (d.titulo ILIKE ${likePct(searchTerm)} OR d.artista ILIKE ${likePct(searchTerm)})`
    : Prisma.sql``;
  const whereArtista = artista
    ? Prisma.sql`AND d.artista = ${artista}`
    : Prisma.sql``;
  const wherePrecoMax =
    precoMax !== null && !isNaN(precoMax)
      ? Prisma.sql`AND hp_latest."precoBrl" <= ${precoMax}`
      : Prisma.sql``;
  const order = buildOrderBy(sort);

  const [countResult, rows] = await Promise.all([
    prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total
      FROM   "Disco" d
      INNER JOIN LATERAL (
        SELECT "precoBrl"
        FROM   "HistoricoPreco"
        WHERE  "discoId" = d.id
        ORDER  BY "capturadoEm" DESC
        LIMIT  1
      ) hp_latest ON true
      WHERE  TRUE ${whereSearch} ${whereArtista} ${wherePrecoMax}
    `,

    prisma.$queryRaw<DiscoRow[]>`
      WITH base AS (
        SELECT
          d.id,
          d.titulo,
          d.artista,
          d.slug,
          d.estilo,
          d."imgUrl",
          d.url,
          d.rating,
          d."reviewCount",
          d.deal_score        AS "dealScore",
          d.confidence_level  AS "confidenceLevel",
          d.history_days      AS "historyDays",
          d.last_crawled_at   AS "lastCrawledAt",
          hp_latest."precoBrl"                              AS "precoAtual",
          COALESCE(hp_avg.media, hp_latest."precoBrl")      AS "mediaPreco",
          COALESCE(hp_avg.cnt, 0)::INTEGER                  AS "totalPrecos",
          (
            SELECT COALESCE(
              json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
              '[]'::json
            )
            FROM (
              SELECT "precoBrl", "capturadoEm"
              FROM   "HistoricoPreco"
              WHERE  "discoId" = d.id
                AND  "capturadoEm" >= NOW() - INTERVAL '30 days'
              ORDER  BY "capturadoEm" ASC
              LIMIT  10
            ) sp
          ) AS sparkline
        FROM   "Disco" d
        INNER JOIN LATERAL (
          SELECT "precoBrl"
          FROM   "HistoricoPreco"
          WHERE  "discoId" = d.id
          ORDER  BY "capturadoEm" DESC
          LIMIT  1
        ) hp_latest ON true
        LEFT JOIN (
          SELECT
            "discoId",
            AVG("precoBrl")      AS media,
            COUNT(*)::INTEGER    AS cnt
          FROM   "HistoricoPreco"
          WHERE  "capturadoEm" >= NOW() - INTERVAL '30 days'
          GROUP  BY "discoId"
        ) hp_avg ON hp_avg."discoId" = d.id
        WHERE TRUE ${whereSearch} ${whereArtista} ${wherePrecoMax}
      )
      SELECT
        *,
        CASE WHEN "mediaPreco" > 0
          THEN ("mediaPreco" - "precoAtual") / "mediaPreco"
          ELSE 0
        END AS desconto
      FROM  base
      ORDER BY ${order}
      LIMIT  ${PAGE_SIZE}
      OFFSET ${(page - 1) * PAGE_SIZE}
    `,
  ]);

  const total = Number(countResult[0].total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const items = rows.map((row): ProcessedDisco => {
    const precoAtual  = Number(row.precoAtual);
    const mediaPreco  = Number(row.mediaPreco);
    const desconto    = Number(row.desconto);

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

    const rawDealScore =
      row.dealScore !== null && row.dealScore !== undefined
        ? Number(row.dealScore)
        : null;

    // Suppress deal badge if the crawler hasn't confirmed this product in the
    // last 4 hours. Protects against stale data when the crawler hasn't run or
    // failed to re-validate an active deal in Phase 0.
    const DEAL_STALE_MS = 4 * 60 * 60 * 1000;
    const crawledAt = row.lastCrawledAt ? new Date(row.lastCrawledAt).getTime() : null;
    const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
    const dealScore = rawDealScore !== null && !dealIsStale ? rawDealScore : null;

    return {
      id:             row.id,
      slug:           row.slug,
      titulo:         row.titulo,
      artista:        row.artista,
      estilo:         row.estilo,
      imgUrl:         row.imgUrl,
      url:            row.url,
      rating:         row.rating !== null && row.rating !== undefined ? Number(row.rating) : null,
      reviewCount:    row.reviewCount !== null && row.reviewCount !== undefined ? Number(row.reviewCount) : null,
      precoAtual,
      mediaPreco,
      // emPromocao is driven by the deal scorer: a product is on promotion iff
      // deal_score IS NOT NULL (meaning it passed all multi-window scoring gates).
      emPromocao:     dealScore !== null,
      desconto,
      sparkline,
      dealScore,
      confidenceLevel: row.confidenceLevel ?? null,
      historyDays:    row.historyDays !== null && row.historyDays !== undefined ? Number(row.historyDays) : null,
    };
  });

  return { items, total, totalPages };
}
