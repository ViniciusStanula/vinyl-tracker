import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { PAIS_PT, ISO2_TO_SLUG } from "@/lib/paises";

const PAIS_RECORDS_CAP = 240;

export type SerializedPaisData = {
  iso2: string;
  total: number;
  discos: {
    id: string;
    titulo: string;
    artista: string;
    slug: string;
    imgUrl: string | null;
    url: string;
    marketplace: string;
    estilo: string | null;
    rating: string | null;
    reviewCount: number | null;
    precoAtual: number;
    mediaPreco: number;
    desconto: number;
    sparkline: number[];
    dealScore: number | null;
    confidenceLevel: string | null;
    lastCrawledAt: string | null;
  }[];
};

// Shared record projection + price join. Records whose artist's MusicBrainz
// country (ArtistMeta.country) equals the given ISO2 code, available vinyl only.
function paisWhere(iso2: string) {
  return Prisma.sql`
    FROM "Disco" c
    INNER JOIN "ArtistMeta" am ON am.artista = c.artista
    INNER JOIN LATERAL (
      SELECT "precoBrl"::float AS preco
      FROM "HistoricoPreco"
      WHERE "discoId" = c.id
      ORDER BY "capturadoEm" DESC LIMIT 1
    ) hp_latest ON true
    WHERE am.country = ${iso2}
      AND c.disponivel = TRUE
      AND (c.format IS NULL OR c.format = 'vinyl')
      AND c.price_count >= 5
  `;
}

const _getPaisPageData = unstable_cache(
  async (iso2: string): Promise<SerializedPaisData | null> => {
    if (!PAIS_PT[iso2]) return null;

    const where = paisWhere(iso2);

    const countQuery = prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total ${where}
    `;

    const mainQuery = prisma.$queryRaw<{
      id: string;
      titulo: string;
      artista: string;
      slug: string;
      imgUrl: string | null;
      url: string;
      marketplace: string;
      estilo: string | null;
      rating: string | null;
      reviewCount: string | null;
      dealScore: number | null;
      confidenceLevel: string | null;
      lastCrawledAt: Date | null;
      precoAtual: number;
      mediaPreco: number;
      desconto: number;
      sparkline: unknown;
    }[]>`
      SELECT
        c.id,
        c.titulo,
        c.artista,
        c.slug,
        c."imgUrl",
        c.url,
        c.marketplace,
        c.estilo,
        c.rating::text,
        c."reviewCount",
        c.deal_score       AS "dealScore",
        c.confidence_level AS "confidenceLevel",
        c.last_crawled_at  AS "lastCrawledAt",
        hp_latest.preco                              AS "precoAtual",
        COALESCE(c.avg_30d::float, hp_latest.preco)  AS "mediaPreco",
        CASE
          WHEN COALESCE(c.avg_30d::float, 0) > 0
          THEN (COALESCE(c.avg_30d::float, hp_latest.preco) - hp_latest.preco)
               / COALESCE(c.avg_30d::float, hp_latest.preco)
          ELSE 0
        END AS desconto,
        (
          SELECT COALESCE(
            json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
            '[]'::json
          )
          FROM (
            SELECT "precoBrl", "capturadoEm"
            FROM "HistoricoPreco"
            WHERE "discoId" = c.id
              AND "capturadoEm" >= NOW() - INTERVAL '30 days'
            ORDER BY "capturadoEm" ASC
            LIMIT 10
          ) sp
        ) AS sparkline
      ${where}
      ORDER BY desconto DESC NULLS LAST
      LIMIT ${PAIS_RECORDS_CAP}
    `;

    const [countResult, rows] = await Promise.all([countQuery, mainQuery]);
    const total = Number(countResult[0].total);

    return {
      iso2,
      total,
      discos: rows.map((row) => {
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
        return {
          id: row.id,
          titulo: row.titulo,
          artista: row.artista,
          slug: row.slug,
          imgUrl: row.imgUrl,
          url: row.url,
          marketplace: row.marketplace,
          estilo: row.estilo,
          rating: row.rating ?? null,
          reviewCount: row.reviewCount !== null ? Number(row.reviewCount) : null,
          precoAtual: Number(row.precoAtual),
          mediaPreco: Number(row.mediaPreco),
          desconto: Number(row.desconto),
          sparkline,
          dealScore: row.dealScore !== null && row.dealScore !== undefined ? Number(row.dealScore) : null,
          confidenceLevel: row.confidenceLevel ?? null,
          lastCrawledAt: row.lastCrawledAt ? new Date(row.lastCrawledAt).toISOString() : null,
        };
      }),
    };
  },
  ["pais-page"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getPaisPageData = cache(_getPaisPageData);

export type PaisListItem = { iso2: string; nome: string; slug: string; discoCount: number };

const _getPaisesList = unstable_cache(
  async (): Promise<PaisListItem[]> => {
    const rows = await prisma.$queryRaw<{ country: string; disco_count: bigint }[]>`
      SELECT am.country, COUNT(*) AS disco_count
      FROM "Disco" c
      INNER JOIN "ArtistMeta" am ON am.artista = c.artista
      WHERE am.country IS NOT NULL
        AND c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
      GROUP BY am.country
      HAVING COUNT(*) > 3
      ORDER BY COUNT(*) DESC
    `;
    const result: PaisListItem[] = [];
    for (const r of rows) {
      const nome = PAIS_PT[r.country];
      const slug = ISO2_TO_SLUG[r.country];
      if (!nome || !slug) continue; // unknown/invalid ISO code — skip
      result.push({ iso2: r.country, nome, slug, discoCount: Number(r.disco_count) });
    }
    return result;
  },
  ["paises-list"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getPaisesList = cache(_getPaisesList);
