import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { slugifyStyle } from "@/lib/utils/styleUtils";

// Same accent-normalization constants as the artist page SQL slug matching
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiioooouuuucny";

const ESTILO_PAGE_SIZE = 60;

function estiloOrderBy(sort: string): Prisma.Sql {
  switch (sort) {
    case "deals":       return Prisma.sql`c.deal_score DESC NULLS LAST, desconto DESC NULLS LAST`;
    case "menor-preco": return Prisma.sql`hp_latest.preco ASC`;
    case "maior-preco": return Prisma.sql`hp_latest.preco DESC`;
    case "avaliados":   return Prisma.sql`c.rating::float DESC NULLS LAST`;
    case "az":          return Prisma.sql`c.titulo ASC`;
    default:            return Prisma.sql`desconto DESC NULLS LAST`;
  }
}

export type SerializedEstiloData = {
  canonical: string;
  bioShortPt: string | null;
  bioPt: string | null;
  total: number;
  totalPages: number;
  discos: {
    id: string;
    titulo: string;
    artista: string;
    slug: string;
    imgUrl: string | null;
    url: string;
    estilo: string | null;
    rating: string | null;
    precoAtual: number;
    mediaPreco: number;
    desconto: number;
    sparkline: number[];
    dealScore: number | null;
    confidenceLevel: string | null;
    lastCrawledAt: string | null;
  }[];
};

export type RelatedEstilo = { tag: string; slug: string };

const _getEstiloPageData = unstable_cache(
  async (
    slug: string,
    page: number,
    sort: string,
    precoMax: number | null,
  ): Promise<SerializedEstiloData | null> => {
    const canonicalRow = await prisma.$queryRaw<{ tag: string }[]>`
      WITH tags AS (
        SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
      )
      SELECT tag FROM tags
      WHERE regexp_replace(
              regexp_replace(
                translate(lower(tag), ${ACCENT_FROM}, ${ACCENT_TO}),
                '[^a-z0-9]+', '-', 'g'
              ),
              '^-+|-+$', '', 'g'
            ) = ${slug}
      LIMIT 1
    `;

    if (canonicalRow.length === 0) return null;
    const canonical = canonicalRow[0].tag;

    const wherePrecoMax =
      precoMax !== null && !isNaN(precoMax)
        ? Prisma.sql`AND hp_latest.preco <= ${precoMax}`
        : Prisma.sql``;

    const orderBy  = estiloOrderBy(sort);
    const offset   = (page - 1) * ESTILO_PAGE_SIZE;

    const bioQuery = prisma.$queryRaw<{ bioShortPt: string | null; bioPt: string | null }[]>`
      SELECT bio_short_pt AS "bioShortPt", bio_pt AS "bioPt"
      FROM "EstiloMeta"
      WHERE tag = LOWER(${canonical})
      LIMIT 1
    `;

    const countQuery = prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total
      FROM "Disco" c
      INNER JOIN LATERAL (
        SELECT "precoBrl"::float AS preco
        FROM "HistoricoPreco"
        WHERE "discoId" = c.id
        ORDER BY "capturadoEm" DESC LIMIT 1
      ) hp_latest ON true
      WHERE LOWER(${canonical}) = ANY(string_to_array(LOWER(c.lastfm_tags), ', '))
        AND c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        ${wherePrecoMax}
    `;

    const mainQuery = prisma.$queryRaw<{
      id: string;
      titulo: string;
      artista: string;
      slug: string;
      imgUrl: string | null;
      url: string;
      estilo: string | null;
      rating: string | null;
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
        c.estilo,
        c.rating::text,
        c.deal_score       AS "dealScore",
        c.confidence_level AS "confidenceLevel",
        c.last_crawled_at  AS "lastCrawledAt",
        hp_latest.preco                                        AS "precoAtual",
        COALESCE(c.avg_30d::float, hp_latest.preco)           AS "mediaPreco",
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
      FROM "Disco" c
      INNER JOIN LATERAL (
        SELECT "precoBrl"::float AS preco
        FROM "HistoricoPreco"
        WHERE "discoId" = c.id
        ORDER BY "capturadoEm" DESC LIMIT 1
      ) hp_latest ON true
      WHERE LOWER(${canonical}) = ANY(string_to_array(LOWER(c.lastfm_tags), ', '))
        AND c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        ${wherePrecoMax}
      ORDER BY ${orderBy}
      LIMIT ${ESTILO_PAGE_SIZE}
      OFFSET ${offset}
    `;

    const [bioRows, countResult, rows] = await Promise.all([bioQuery, countQuery, mainQuery]);

    const bio   = bioRows[0] ?? null;
    const total = Number(countResult[0].total);
    const totalPages = Math.max(1, Math.ceil(total / ESTILO_PAGE_SIZE));

    return {
      canonical,
      bioShortPt:  bio?.bioShortPt ?? null,
      bioPt:       bio?.bioPt ?? null,
      total,
      totalPages,
      discos: rows.map((row) => {
        let sparkline: number[] = [];
        if (Array.isArray(row.sparkline)) {
          sparkline = (row.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
        } else if (typeof row.sparkline === "string") {
          try {
            sparkline = (JSON.parse(row.sparkline) as unknown[])
              .map(Number)
              .filter((n) => !isNaN(n));
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
          estilo: row.estilo,
          rating: row.rating ?? null,
          precoAtual: Number(row.precoAtual),
          mediaPreco: Number(row.mediaPreco),
          desconto: Number(row.desconto),
          sparkline,
          dealScore:
            row.dealScore !== null && row.dealScore !== undefined
              ? Number(row.dealScore)
              : null,
          confidenceLevel: row.confidenceLevel ?? null,
          lastCrawledAt: row.lastCrawledAt
            ? new Date(row.lastCrawledAt).toISOString()
            : null,
        };
      }),
    };
  },
  ["estilo-page"],
  { tags: ["prices"], revalidate: 86400 }
);

export const getEstiloPageData = cache(_getEstiloPageData);

const _getRelatedEstilos = unstable_cache(
  async (canonical: string): Promise<RelatedEstilo[]> => {
    const rows = await prisma.$queryRaw<{ tag: string }[]>`
      WITH current_discos AS (
        SELECT id FROM "Disco"
        WHERE disponivel = TRUE
        AND  (format IS NULL OR format = 'vinyl')
          AND LOWER(${canonical}) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
      ),
      all_tags AS (
        SELECT tag, COUNT(DISTINCT id)::float AS total
        FROM (
          SELECT id, LOWER(unnest(string_to_array(lastfm_tags, ', '))) AS tag
          FROM "Disco"
          WHERE disponivel = TRUE
          AND  (format IS NULL OR format = 'vinyl')
        ) t
        GROUP BY tag
      ),
      shared_tags AS (
        SELECT tag, COUNT(DISTINCT id)::float AS shared
        FROM (
          SELECT d.id, LOWER(unnest(string_to_array(d.lastfm_tags, ', '))) AS tag
          FROM "Disco" d
          INNER JOIN current_discos cd ON cd.id = d.id
          WHERE d.disponivel = TRUE
          AND  (d.format IS NULL OR d.format = 'vinyl')
        ) t
        GROUP BY tag
      ),
      current_size AS (SELECT COUNT(*)::float AS cnt FROM current_discos)
      SELECT s.tag
      FROM shared_tags s
      JOIN all_tags a ON a.tag = s.tag
      CROSS JOIN current_size cs
      WHERE s.tag != LOWER(${canonical})
        AND s.shared > 0
      ORDER BY s.shared / (cs.cnt + a.total - s.shared) DESC
      LIMIT 10
    `;
    return rows.map((r) => ({ tag: r.tag, slug: slugifyStyle(r.tag) }));
  },
  ["estilo-related"],
  { tags: ["prices"], revalidate: 86400 }
);

export const getRelatedEstilos = cache(_getRelatedEstilos);
