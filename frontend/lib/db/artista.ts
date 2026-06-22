import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { slugifyArtist } from "@/lib/utils/slugify";
import { getTopStyles } from "@/lib/utils/styleUtils";
import { buildOrderBy, PAGE_SIZE, type ProcessedDisco } from "@/lib/queryDiscos";

// translate() constant strings — same character table as slugifyArtist() NFD normalization
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiioooouuuucny";

type ArtistaRow = {
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
  sparkline: unknown;
  dealScore: string | null;
  confidenceLevel: string | null;
  historyDays: string | null;
  lastCrawledAt: Date | null;
  lastfmTags: string | null;
};

export type ArtistaPageData = {
  canonical: string;
  items: ProcessedDisco[];
  total: number;
  totalPages: number;
  topStyles: string[];
  sameAs: string[];
  bioShortPt: string | null;
  bioPt: string | null;
  unavailableItems: ProcessedDisco[];
};

type UnavailableRow = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: string | null;
  reviewCount: string | null;
};

const _getArtistaPageData = unstable_cache(
  async (
    slug: string,
    page: number,
    sort: string,
    precoMax: number | null,
  ): Promise<ArtistaPageData | null> => {
    // Pre-filter at the DB level using a SQL slug approximation so we transfer
    // only candidates instead of the full artist table. Two expressions cover:
    //   1. Regular names: lower(regexp_replace(artista, '[^a-z0-9]+', '-', 'g'))
    //   2. Inverted "LAST,FIRST" names: swap parts before slugifying
    // The JS slugifyArtist() filter below is the exact match safety-net for
    // edge cases (accent stripping via NFD that SQL doesn't reproduce exactly).
    // Inlined as Prisma.raw() (not bound parameters) so PostgreSQL can match
    // idx_disco_artista_slug_expr and idx_disco_artista_slug_inverted exactly.
    // Safe: these are hardcoded constants, not user input.
    const AF = Prisma.raw(`'${ACCENT_FROM}'`);
    const AT = Prisma.raw(`'${ACCENT_TO}'`);

    const candidates = await prisma.$queryRaw<{ artista: string }[]>`
      SELECT DISTINCT artista FROM "Disco"
      WHERE left(
              regexp_replace(
                regexp_replace(translate(lower(artista), ${AF}, ${AT}), '[^a-z0-9]+', '-', 'g'),
                '^-+|-+$', '', 'g'
              ), 60) = ${slug}
         OR left(
              regexp_replace(
                regexp_replace(
                  translate(
                    lower(trim(split_part(artista, ',', 2)) || ' ' || trim(split_part(artista, ',', 1))),
                    ${AF}, ${AT}
                  ),
                  '[^a-z0-9]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
              ), 60) = ${slug}
    `;

    const variants = candidates
      .map((r) => r.artista)
      .filter((a) => slugifyArtist(a) === slug);

    if (variants.length === 0) return null;

    // Pick the cleanest name: prefer no comma, then shortest (usually proper-cased)
    const canonical = variants.slice().sort((a, b) => {
      const aScore = (a.includes(",") ? 1 : 0) + (a === a.toUpperCase() ? 1 : 0);
      const bScore = (b.includes(",") ? 1 : 0) + (b === b.toUpperCase() ? 1 : 0);
      return aScore - bScore || a.length - b.length;
    })[0];

    const order = buildOrderBy(sort);
    const offset = (page - 1) * PAGE_SIZE;
    const wherePrecoMax =
      precoMax !== null && !isNaN(precoMax)
        ? Prisma.sql`AND hp_latest."precoBrl" <= ${precoMax}`
        : Prisma.sql``;

    // COUNT skips the HistoricoPreco LATERAL when there is no price-max filter
    const countQuery =
      precoMax !== null && !isNaN(precoMax)
        ? prisma.$queryRaw<[{ total: bigint }]>`
            SELECT COUNT(*) AS total
            FROM   "Disco" d
            INNER JOIN LATERAL (
              SELECT "precoBrl"
              FROM   "HistoricoPreco"
              WHERE  "discoId" = d.id AND "precoBrl" >= 30
              ORDER  BY "capturadoEm" DESC LIMIT 1
            ) hp_latest ON true
            WHERE  d.artista = ANY(${variants})
              AND  d.disponivel = TRUE
              AND  (d.format IS NULL OR d.format = 'vinyl')
              AND  d.price_count >= 5
              AND  hp_latest."precoBrl" <= ${precoMax}
          `
        : prisma.$queryRaw<[{ total: bigint }]>`
            SELECT COUNT(*) AS total
            FROM   "Disco" d
            WHERE  d.artista = ANY(${variants})
              AND  d.disponivel = TRUE
              AND  (d.format IS NULL OR d.format = 'vinyl')
              AND  d.price_count >= 5
          `;

    const tagsQuery = prisma.$queryRaw<{ lastfmTags: string | null }[]>`
      SELECT lastfm_tags AS "lastfmTags"
      FROM   "Disco"
      WHERE  artista = ANY(${variants})
        AND  disponivel = TRUE
        AND  (format IS NULL OR format = 'vinyl')
        AND  price_count >= 5
        AND  lastfm_tags IS NOT NULL AND lastfm_tags != ''
    `;

    const mainQuery = prisma.$queryRaw<ArtistaRow[]>`
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
          d.lastfm_tags       AS "lastfmTags",
          hp_latest."precoBrl"                              AS "precoAtual",
          COALESCE(d.avg_30d::float, hp_latest."precoBrl")  AS "mediaPreco",
          d.price_count::INTEGER                            AS "totalPrecos",
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
                AND  "precoBrl" >= 30
              ORDER  BY "capturadoEm" DESC
              LIMIT  10
            ) sp
          ) AS sparkline
        FROM   "Disco" d
        INNER JOIN LATERAL (
          SELECT "precoBrl"
          FROM   "HistoricoPreco"
          WHERE  "discoId" = d.id AND "precoBrl" >= 30
          ORDER  BY "capturadoEm" DESC LIMIT 1
        ) hp_latest ON true
        WHERE  d.artista = ANY(${variants})
          AND  d.disponivel = TRUE
          AND  (d.format IS NULL OR d.format = 'vinyl')
          AND  d.price_count >= 5
          ${wherePrecoMax}
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
      OFFSET ${offset}
    `;

    const metaQuery = prisma.$queryRaw<{
      wikidataUrl: string | null;
      wikipediaUrl: string | null;
      spotifyUrl: string | null;
      bioShortPt: string | null;
      bioPt: string | null;
    }[]>`
      SELECT wikidata_url  AS "wikidataUrl",
             wikipedia_url AS "wikipediaUrl",
             spotify_url   AS "spotifyUrl",
             bio_short_pt  AS "bioShortPt",
             bio_pt        AS "bioPt"
      FROM "ArtistMeta"
      WHERE artista = ANY(${variants})
      LIMIT 1
    `;

    const unavailableQuery = prisma.$queryRaw<UnavailableRow[]>`
      SELECT id, titulo, artista, slug, estilo, "imgUrl", url, rating, "reviewCount"
      FROM "Disco"
      WHERE artista = ANY(${variants})
        AND disponivel = FALSE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
      ORDER BY titulo ASC
      LIMIT 50
    `;

    const [countResult, rows, tagsRows, metaRows, unavailableRows] = await Promise.all([
      countQuery,
      mainQuery,
      tagsQuery,
      metaQuery,
      unavailableQuery,
    ]);
    const meta = metaRows[0] ?? null;

    const total = Number(countResult[0].total);

    const unavailableItems: ProcessedDisco[] = unavailableRows.map((row) => ({
      id:              row.id,
      slug:            row.slug,
      titulo:          row.titulo,
      artista:         row.artista,
      estilo:          row.estilo,
      imgUrl:          row.imgUrl,
      url:             row.url,
      rating:          row.rating !== null ? Number(row.rating) : null,
      reviewCount:     row.reviewCount !== null ? Number(row.reviewCount) : null,
      precoAtual:      0,
      mediaPreco:      0,
      emPromocao:      false,
      desconto:        0,
      sparkline:       [],
      dealScore:       null,
      confidenceLevel: null,
      historyDays:     null,
      lastfmTags:      null,
      disponivel:      false,
    }));

    if (total === 0 && unavailableItems.length === 0) return null;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const topStyles = getTopStyles(tagsRows.map((r) => r.lastfmTags), 5, canonical);
    const sameAs = [meta?.wikidataUrl, meta?.wikipediaUrl, meta?.spotifyUrl]
      .filter((u): u is string => Boolean(u));
    const bioShortPt = meta?.bioShortPt ?? null;
    const bioPt      = meta?.bioPt ?? null;

    const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

    const items = rows.flatMap((row): ProcessedDisco[] => {
      const precoAtual = Number(row.precoAtual);
      const mediaPreco = Number(row.mediaPreco);
      const desconto   = Number(row.desconto);

      if (isNaN(precoAtual) || isNaN(mediaPreco) || isNaN(desconto)) {
        // eslint-disable-next-line no-console
        console.warn("[artista/%s] NaN numeric field for disco id=%s — skipping", slug, row.id);
        return [];
      }

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
      const crawledAt = row.lastCrawledAt ? new Date(row.lastCrawledAt).getTime() : null;
      const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
      const dealScore = rawDealScore !== null && !dealIsStale ? rawDealScore : null;

      return [{
        id:              row.id,
        slug:            row.slug,
        titulo:          row.titulo,
        artista:         row.artista,
        estilo:          row.estilo,
        imgUrl:          row.imgUrl,
        url:             row.url,
        rating:          row.rating !== null && row.rating !== undefined ? Number(row.rating) : null,
        reviewCount:     row.reviewCount !== null && row.reviewCount !== undefined ? Number(row.reviewCount) : null,
        precoAtual,
        mediaPreco,
        emPromocao:      dealScore !== null,
        desconto,
        sparkline,
        dealScore,
        confidenceLevel: row.confidenceLevel ?? null,
        historyDays:     row.historyDays !== null && row.historyDays !== undefined ? Number(row.historyDays) : null,
        lastfmTags:      row.lastfmTags ?? null,
      }];
    });

    return { canonical, items, total, totalPages, topStyles, sameAs, bioShortPt, bioPt, unavailableItems };
  },
  ["artista-page"],
  { tags: ["prices"], revalidate: 1800 }
);

export const getArtistaPageData = cache(_getArtistaPageData);

export type ArtistaListItem = {
  artista: string;
  slug: string;
  discoCount: number;
  imgUrl: string | null;
};

const _getArtistasList = unstable_cache(
  async (): Promise<ArtistaListItem[]> => {
    const rows = await prisma.$queryRaw<{
      artista: string;
      discoCount: bigint;
      imgUrl: string | null;
    }[]>`
      SELECT
        artista,
        COUNT(*) AS "discoCount",
        MIN("imgUrl") FILTER (WHERE "imgUrl" IS NOT NULL) AS "imgUrl"
      FROM "Disco"
      WHERE disponivel = TRUE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
      GROUP BY artista
      ORDER BY artista ASC
    `;
    return rows.map((r) => ({
      artista: r.artista,
      slug: slugifyArtist(r.artista),
      discoCount: Number(r.discoCount),
      imgUrl: r.imgUrl,
    }));
  },
  ["artistas-list"],
  { tags: ["prices"], revalidate: 86400 }
);

export const getArtistasList = cache(_getArtistasList);
