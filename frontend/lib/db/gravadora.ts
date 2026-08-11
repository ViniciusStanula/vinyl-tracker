import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";

/**
 * Record label ("selo" / "gravadora") listings — /gravadora/<slug>.
 *
 * The label lives on Disco as two columns and neither is complete: Discogs
 * covers 23,876 listable records and MusicBrainz 9,831, so the value is
 * COALESCE(discogs_label, mb_label) — the same precedence the record page
 * already uses for its "lançada pelo selo X" line.
 */

// Below this a label page is a bare grid — renders, but noindex and out of the
// sitemap. Same bar as the genre × decade cells.
export const GRAVADORA_MIN = 16;

/**
 * How many label pages the sitemap exposes, biggest first. 268 labels clear
 * GRAVADORA_MIN; they go out in batches rather than all at once. Raise, watch
 * Search Console for 2–4 weeks, raise again.
 */
export const GRAVADORA_SITEMAP_LIMIT = 100;

const RECORDS_CAP = 240;

// Same accent table as estilo.ts's canonical lookup.
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO = "aaaaaaeeeeiiiiooooouuuucny";

/**
 * Discogs disambiguates same-named labels with a numeric suffix — "Rhino
 * Records" and "Rhino Records (2)" are the same company to a reader, and
 * splitting them left 154 records on one page and 71 on a page nobody would
 * ever guess the URL of. Stripped before grouping.
 */
const LABEL_RAW = Prisma.sql`NULLIF(BTRIM(COALESCE(NULLIF(c.discogs_label, ''), c.mb_label)), '')`;
const LABEL = Prisma.sql`BTRIM(regexp_replace(${LABEL_RAW}, '\\s*\\([0-9]+\\)$', ''))`;

/**
 * "Not On Label" is Discogs' marker for a self-release, not a label — the
 * variants carry the artist's own name ("Not On Label (JPEGMAFIA
 * Self-released)"), so grouping them would invent a label page per artist.
 */
const LABEL_VALIDO = Prisma.sql`
  ${LABEL_RAW} IS NOT NULL
  AND ${LABEL} !~* '^not on label'
  AND length(${LABEL}) >= 2
`;

/** SQL slug of the normalized label — mirrors slugifyLabel() below. */
const LABEL_SLUG = Prisma.sql`
  regexp_replace(
    regexp_replace(
      translate(lower(${LABEL}), ${ACCENT_FROM}, ${ACCENT_TO}),
      '[^a-z0-9]+', '-', 'g'
    ),
    '^-+|-+$', '', 'g'
  )
`;

/** JS twin of LABEL_SLUG. Must produce identical output — it builds the links
 *  that LABEL_SLUG then has to resolve. */
export function slugifyLabel(label: string): string {
  return label
    .replace(/\s*\([0-9]+\)$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

const LISTABLE = Prisma.sql`
  c.disponivel = TRUE
  AND (c.format IS NULL OR c.format = 'vinyl')
  AND c.price_count >= 5
`;

export type GravadoraData = {
  label: string;
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

const _getGravadoraData = unstable_cache(
  async (slug: string): Promise<GravadoraData | null> => {
    // Two labels can slugify the same way; the bigger catalogue wins the URL,
    // which is also the one a searcher meant.
    const labelRow = await prisma.$queryRaw<{ label: string }[]>`
      SELECT ${LABEL} AS label
      FROM "Disco" c
      WHERE ${LISTABLE} AND ${LABEL_VALIDO} AND ${LABEL_SLUG} = ${slug}
      GROUP BY ${LABEL}
      ORDER BY COUNT(*) DESC
      LIMIT 1
    `;
    if (labelRow.length === 0) return null;
    const label = labelRow[0].label;

    const where = Prisma.sql`
      WHERE ${LISTABLE}
        AND ${LABEL} = ${label}
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
      ${where}
      ORDER BY desconto DESC NULLS LAST
      LIMIT ${RECORDS_CAP}
    `;

    const [countResult, rows] = await Promise.all([countQuery, mainQuery]);
    const total = Number(countResult[0].total);
    if (total === 0) return null;

    return {
      label,
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
  ["gravadora-page"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getGravadoraData = cache(_getGravadoraData);

export type GravadoraListItem = { label: string; slug: string; discoCount: number };

/** Labels that clear GRAVADORA_MIN, biggest first. Drives the hub and sitemap. */
const _getGravadorasList = unstable_cache(
  async (): Promise<GravadoraListItem[]> => {
    const rows = await prisma.$queryRaw<{ label: string; disco_count: bigint }[]>`
      SELECT ${LABEL} AS label, COUNT(*) AS disco_count
      FROM "Disco" c
      WHERE ${LISTABLE} AND ${LABEL_VALIDO}
      GROUP BY ${LABEL}
      HAVING COUNT(*) >= ${GRAVADORA_MIN}
      ORDER BY COUNT(*) DESC
    `;

    const seen = new Set<string>();
    const result: GravadoraListItem[] = [];
    for (const r of rows) {
      const slug = slugifyLabel(r.label);
      // Rows arrive biggest first, so on a slug collision the first one wins —
      // the same label getGravadoraData resolves that slug to.
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      result.push({ label: r.label, slug, discoCount: Number(r.disco_count) });
    }
    return result;
  },
  ["gravadoras-list"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getGravadorasList = cache(_getGravadorasList);

/** Slugs with a real page, for deciding whether to link a label on a record
 *  page. Cheap string array on its own 24h key — the label vocabulary moves on
 *  the order of days and no price is involved in the decision. */
const _getGravadoraSlugSet = unstable_cache(
  async (): Promise<string[]> => (await _getGravadorasList()).map((g) => g.slug),
  ["gravadora-slug-set"],
  { revalidate: 86400 },
);

export const getGravadoraSlugSet = cache(
  async (): Promise<Set<string>> => new Set(await _getGravadoraSlugSet()),
);
