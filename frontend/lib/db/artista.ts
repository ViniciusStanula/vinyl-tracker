import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { slugifyArtist } from "@/lib/utils/slugify";
import { getTopStyles } from "@/lib/utils/styleUtils";
import { buildOrderBy, PAGE_SIZE, type ProcessedDisco } from "@/lib/queryDiscos";

// translate() constant strings — same character table as slugifyArtist() NFD normalization
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiiooooouuuucny";

// Uppercase forms too, for the A-Z bucketing below. Folding only the lowercase
// ones left "Ávila" starting with a literal Á, and Postgres collation makes
// 'Á' BETWEEN 'A' AND 'Z' true — so it became its own bucket, the index linked
// to /artistas/á, and that route 404s because it only accepts ASCII A-Z.
// Three such buckets existed (Á, Å, É) holding five artists reachable from no
// letter page at all.
const ACCENT_FROM_UPPER = "ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ";
const ACCENT_TO_UPPER   = "AAAAAAEEEEIIIIOOOOOUUUUCNY";

/** First letter of an artist name, accent-folded, or NULL when it is not A-Z.
 *
 *  Compared with a regex rather than BETWEEN: BETWEEN uses the database
 *  collation, under which accented and other Latin letters sort inside the A-Z
 *  range, so it accepted characters the URL cannot carry.
 */
const INITIAL_SQL = Prisma.sql`upper(left(translate(artista,
  ${ACCENT_FROM + ACCENT_FROM_UPPER}, ${ACCENT_TO + ACCENT_TO_UPPER}), 1))`;

type ArtistaRow = {
  id: string;
  titulo: string;
  tituloSeo: string | null;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  marketplace: string;
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
  country: string | null;
  unavailableItems: ProcessedDisco[];
};

type UnavailableRow = {
  id: string;
  titulo: string;
  tituloSeo: string | null;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  marketplace: string;
  rating: string | null;
  reviewCount: string | null;
};

const _getArtistaPageData = unstable_cache(
  async (
    slug: string,
    page: number,
    sort: string,
    precoMax: number | null,
    // Page render passes a large pageSize to fetch the artist's whole catalog in
    // one shot so sort/filter/pagination can run client-side (keeps the route
    // ISR-cacheable — no server searchParams). Defaults to PAGE_SIZE for any
    // legacy paginated caller.
    pageSize: number = PAGE_SIZE,
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
          d.titulo_seo        AS "tituloSeo",
          d.artista,
          d.slug,
          d.estilo,
          d."imgUrl",
          d.url,
          d.marketplace,
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
      LIMIT  ${pageSize}
      OFFSET ${offset}
    `;

    const metaQuery = prisma.$queryRaw<{
      wikidataUrl: string | null;
      wikipediaUrl: string | null;
      spotifyUrl: string | null;
      mbid: string | null;
      mbUrls: Record<string, string[]> | null;
      bioShortPt: string | null;
      bioPt: string | null;
      country: string | null;
    }[]>`
      SELECT wikidata_url  AS "wikidataUrl",
             wikipedia_url AS "wikipediaUrl",
             spotify_url   AS "spotifyUrl",
             mbid          AS "mbid",
             mb_urls       AS "mbUrls",
             bio_short_pt  AS "bioShortPt",
             bio_pt        AS "bioPt",
             country       AS "country"
      FROM "ArtistMeta"
      WHERE artista = ANY(${variants})
      LIMIT 1
    `;

    const unavailableQuery = prisma.$queryRaw<UnavailableRow[]>`
      SELECT id, titulo, titulo_seo AS "tituloSeo", artista, slug, estilo, "imgUrl", url, marketplace, rating, "reviewCount"
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
      tituloSeo:       row.tituloSeo,
      artista:         row.artista,
      estilo:          row.estilo,
      imgUrl:          row.imgUrl,
      url:             row.url,
      marketplace:     row.marketplace,
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
    // Relation types from ArtistMeta.mb_urls that identify the ARTIST as an
    // entity. MusicBrainz also returns "streaming"/"free streaming", which are
    // deliberately excluded: those lists mix real profiles with per-release
    // store URLs (Amazon /gp/product/... shows up there), and a store page for
    // one record is not an identifier for the artist.
    const SAMEAS_RELATIONS = [
      "official homepage",
      "social network",
      "soundcloud",
      "bandcamp",
      "youtube",
      "discogs",
      "allmusic",
    ] as const;

    const sameAs = [
      ...new Set(
        [
          meta?.wikidataUrl,
          meta?.wikipediaUrl,
          meta?.spotifyUrl,
          // mbid covers ~6x more artists (10.5k) than the three URL fields
          // combined (~1.7k) -- most of this catalog's artist-level entity
          // linking comes from here, not from the other three.
          meta?.mbid ? `https://musicbrainz.org/artist/${meta.mbid}` : null,
          // MusicBrainz url-rels: 9,409 artists carry these, so this is now the
          // widest source of entity links by a distance. Deduped against the
          // fields above because wikidata arrives from both.
          ...SAMEAS_RELATIONS.flatMap((rel) => meta?.mbUrls?.[rel] ?? []),
          ...(meta?.mbUrls?.["wikidata"] ?? []),
        ].filter((u): u is string => Boolean(u)),
      ),
    ];
    const bioShortPt = meta?.bioShortPt ?? null;
    const country = meta?.country ?? null;
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
        tituloSeo:       row.tituloSeo,
        artista:         row.artista,
        estilo:          row.estilo,
        imgUrl:          row.imgUrl,
        url:             row.url,
        marketplace:     row.marketplace,
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

    return { canonical, items, total, totalPages, topStyles, sameAs, bioShortPt, bioPt, country, unavailableItems };
  },
  ["artista-page"],
  { tags: ["prices"], revalidate: 14400 }
);

export const getArtistaPageData = cache(_getArtistaPageData);

export type ArtistaListItem = {
  artista: string;
  slug: string;
  discoCount: number;
  imgUrl: string | null;
  /** Max Last.fm listeners across the artist's records — popularity signal for
   *  ranking the featured mosaic. 0 when the artist has no Last.fm match. */
  listeners: number;
};

const _getArtistasList = unstable_cache(
  async (): Promise<ArtistaListItem[]> => {
    const rows = await prisma.$queryRaw<{
      artista: string;
      discoCount: bigint;
      imgUrl: string | null;
      listeners: number | null;
    }[]>`
      SELECT
        artista,
        COUNT(*) AS "discoCount",
        MIN("imgUrl") FILTER (WHERE "imgUrl" IS NOT NULL) AS "imgUrl",
        MAX(lastfm_listeners) AS listeners
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
      listeners: Number(r.listeners ?? 0),
    }));
  },
  ["artistas-list"],
  { tags: ["prices"], revalidate: 14400 }
);

export const getArtistasList = cache(_getArtistasList);

/** How many artists sit under each initial, for the /artistas letter tiles. */
const _getArtistaLetterCounts = unstable_cache(
  async (): Promise<{ letra: string; total: number }[]> => {
    const rows = await prisma.$queryRaw<{ letra: string; total: bigint }[]>`
      SELECT letra, COUNT(*) AS total FROM (
        SELECT CASE
                 WHEN ${INITIAL_SQL} ~ '^[A-Z]$' THEN ${INITIAL_SQL}
                 ELSE '#'
               END AS letra
        FROM "Disco"
        WHERE disponivel = TRUE AND (format IS NULL OR format = 'vinyl')
          AND price_count >= 5
        GROUP BY artista
      ) t
      GROUP BY letra
      ORDER BY letra
    `;
    return rows.map((r) => ({ letra: r.letra, total: Number(r.total) }));
  },
  ["artistas-letter-counts"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getArtistaLetterCounts = cache(_getArtistaLetterCounts);

/**
 * One letter's slice of the A-Z index.
 *
 * The index used to render all 11,999 artists on a single page: 9.2 MB of HTML
 * plus the matching RSC payload, on a route the header menu now links from
 * every page. Filtering in SQL keeps each letter page to its own slice — the
 * largest, T, is 1,302 artists.
 *
 * Accents fold before the initial is taken, so Ólafur files under O rather than
 * its own bucket, matching how the letter counts are grouped.
 */
const _getArtistasByLetter = unstable_cache(
  async (letra: string): Promise<ArtistaListItem[]> => {
    // "#" is everything whose initial is not A-Z: numbers, symbols, and
    // non-Latin scripts.
    const letterFilter =
      letra === "#"
        ? Prisma.sql`AND ${INITIAL_SQL} !~ '^[A-Z]$'`
        : Prisma.sql`AND ${INITIAL_SQL} = ${letra}`;
    const rows = await prisma.$queryRaw<{
      artista: string;
      discoCount: bigint;
      imgUrl: string | null;
      listeners: number | null;
    }[]>`
      SELECT
        artista,
        COUNT(*) AS "discoCount",
        MIN("imgUrl") FILTER (WHERE "imgUrl" IS NOT NULL) AS "imgUrl",
        MAX(lastfm_listeners) AS listeners
      FROM "Disco"
      WHERE disponivel = TRUE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
        ${letterFilter}
      GROUP BY artista
      ORDER BY artista ASC
    `;
    return rows.map((r) => ({
      artista: r.artista,
      slug: slugifyArtist(r.artista),
      discoCount: Number(r.discoCount),
      imgUrl: r.imgUrl,
      listeners: Number(r.listeners ?? 0),
    }));
  },
  ["artistas-by-letter"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getArtistasByLetter = cache(_getArtistasByLetter);
