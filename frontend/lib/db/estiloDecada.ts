import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { slugifyStyle } from "@/lib/utils/styleUtils";
import { REDIRECTED_ESTILO_SLUGS } from "./estilo";
import { COUNTRY_TAG_TO_PAIS_SLUG } from "@/lib/paises";
import { DECADES } from "@/lib/decadas";

/**
 * Genre × decade listings — /estilo/<slug>/<decada>.
 *
 * Membership and canonical resolution follow estilo.ts exactly: a record
 * belongs to a style when EITHER lastfm_tags or discogs_styles says so, but the
 * canonical vocabulary stays derived from lastfm_tags alone. That asymmetry is
 * what stops new pages appearing — Discogs carries ~171 style names with no
 * page behind them, and one page per term is how index bloat starts.
 *
 * The year is the earlier of MusicBrainz and the Discogs master, the same
 * reconciliation /decada and the record page use, so a record can never appear
 * under one decade here and another there.
 */

// Below this a cell is a bare grid with nothing to say — it renders, but
// noindex, and it never enters the sitemap.
export const ESTILO_DECADA_MIN = 16;

/**
 * How many cells the sitemap currently exposes, biggest first.
 *
 * ~900 cells clear ESTILO_DECADA_MIN. Publishing them in one go is exactly the
 * pattern Google's scaled-content policy targets, so the sitemap ships a batch
 * at a time: raise this number, watch indexing and rankings for 2–4 weeks in
 * Search Console, raise it again. Every cell still renders and is reachable by
 * link at any value — this only controls what we actively submit.
 */
export const ESTILO_DECADA_SITEMAP_LIMIT = 100;

const RECORDS_CAP = 240;

// Same accent table as estilo.ts's canonical lookup.
const ACCENT_FROM = "àáâãäåçèéêëìíîïñòóôõöùúûüýÿāćčėńōşšūžḥẓọ";
const ACCENT_TO = "aaaaaaceeeeiiiinooooouuuuyyaccenossuzhzo";

const ANO = Prisma.sql`LEAST(
  NULLIF(substring(c.mb_first_release_date from '^[0-9]{4}'), '')::int,
  c.discogs_master_year
)`;

export type EstiloDecadaData = {
  canonical: string;
  total: number;
  discos: {
    id: string;
    titulo: string;
    tituloSeo: string | null;
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

const _getEstiloDecadaData = unstable_cache(
  async (slug: string, decada: number): Promise<EstiloDecadaData | null> => {
    if (!DECADES.includes(decada as (typeof DECADES)[number])) return null;
    if (REDIRECTED_ESTILO_SLUGS.has(slug) || COUNTRY_TAG_TO_PAIS_SLUG[slug]) return null;

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

    const where = Prisma.sql`
      WHERE (LOWER(${canonical}) = ANY(string_to_array(LOWER(c.lastfm_tags), ', '))
          OR LOWER(${canonical}) = ANY(string_to_array(LOWER(c.discogs_styles), ', ')))
        AND c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        AND ${ANO} BETWEEN ${decada} AND ${decada + 9}
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
      ${where}
    `;

    const mainQuery = prisma.$queryRaw<{
      id: string;
      titulo: string;
      tituloSeo: string | null;
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
        c.titulo_seo AS "tituloSeo",
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
              AND "capturadoEm" >= date_trunc('day', NOW()) - INTERVAL '30 days'
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
      ${where}
      ORDER BY desconto DESC NULLS LAST
      LIMIT ${RECORDS_CAP}
    `;

    const [countResult, rows] = await Promise.all([countQuery, mainQuery]);
    const total = Number(countResult[0].total);
    if (total === 0) return null;

    return {
      canonical,
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
          tituloSeo: row.tituloSeo,
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
  ["estilo-decada-page"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getEstiloDecadaData = cache(_getEstiloDecadaData);

export type EstiloDecadaCell = { slug: string; tag: string; decada: number; discoCount: number };

/**
 * Every genre × decade cell that clears ESTILO_DECADA_MIN.
 *
 * Restricted to the lastfm_tags vocabulary, so a cell can only exist when
 * /estilo/<slug> exists too — otherwise the child page's own breadcrumb parent
 * would 404. Redirected slugs and country tags (which redirect to /pais) are
 * dropped for the same reason.
 */
const _getEstiloDecadaCells = unstable_cache(
  async (): Promise<EstiloDecadaCell[]> => {
    const rows = await prisma.$queryRaw<{ tag: string; decada: number; disco_count: bigint }[]>`
      WITH vocab AS (
        SELECT DISTINCT LOWER(unnest(string_to_array(lastfm_tags, ', '))) AS tag
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
      ),
      pairs AS (
        SELECT
          LOWER(t.tag) AS tag,
          (${ANO} / 10) * 10 AS decada,
          c.id
        FROM "Disco" c,
             unnest(string_to_array(c.lastfm_tags, ', ')) AS t(tag)
        WHERE c.lastfm_tags IS NOT NULL AND c.lastfm_tags != ''
          AND c.disponivel = TRUE
          AND (c.format IS NULL OR c.format = 'vinyl')
          AND c.price_count >= 5
          AND ${ANO} IS NOT NULL
        UNION
        SELECT
          LOWER(st.tag),
          (${ANO} / 10) * 10,
          c.id
        FROM "Disco" c,
             unnest(string_to_array(c.discogs_styles, ', ')) AS st(tag)
        WHERE c.discogs_styles IS NOT NULL AND c.discogs_styles != ''
          AND c.disponivel = TRUE
          AND (c.format IS NULL OR c.format = 'vinyl')
          AND c.price_count >= 5
          AND ${ANO} IS NOT NULL
          AND LOWER(st.tag) IN (SELECT tag FROM vocab)
      )
      SELECT tag, decada, COUNT(DISTINCT id) AS disco_count
      FROM pairs
      WHERE decada = ANY(${[...DECADES]}::int[])
      GROUP BY tag, decada
      HAVING COUNT(DISTINCT id) >= ${ESTILO_DECADA_MIN}
      ORDER BY COUNT(DISTINCT id) DESC
    `;

    const cells: EstiloDecadaCell[] = [];
    for (const r of rows) {
      const slug = slugifyStyle(r.tag);
      if (!slug || REDIRECTED_ESTILO_SLUGS.has(slug) || COUNTRY_TAG_TO_PAIS_SLUG[slug]) continue;
      cells.push({ slug, tag: r.tag, decada: Number(r.decada), discoCount: Number(r.disco_count) });
    }
    return cells;
  },
  ["estilo-decada-cells"],
  { revalidate: 86400 },
);

export const getEstiloDecadaCells = cache(_getEstiloDecadaCells);

/** Decades with a page for this style, for the sibling nav on the cell page. */
export const getDecadasForEstilo = cache(async (slug: string): Promise<EstiloDecadaCell[]> => {
  const cells = await getEstiloDecadaCells();
  return cells.filter((c) => c.slug === slug).sort((a, b) => a.decada - b.decada);
});
