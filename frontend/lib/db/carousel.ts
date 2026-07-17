import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { slugifyArtist } from "@/lib/utils/slugify";
import { fetchTopArtists } from "@/lib/external/lastfm";
import type { ProcessedDisco } from "@/lib/queryDiscos";
import { unstable_cache } from "next/cache";

function buildOrderBy(sort: string): Prisma.Sql {
  switch (sort) {
    case "menor-preco": return Prisma.sql`"precoAtual" ASC`;
    case "maior-preco": return Prisma.sql`"precoAtual" DESC`;
    case "avaliados":   return Prisma.sql`COALESCE(rating::numeric, 0) DESC`;
    case "az":          return Prisma.sql`d.titulo ASC`;
    default:            return Prisma.sql`desconto DESC NULLS LAST, d.deal_score DESC NULLS LAST`;
  }
}

type CarouselRow = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  marketplace: string;
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
 * Returns up to 40 deals — best deal per artist — for artists that appear
 * in the Last.fm top-1000 chart. Results are sorted best-deal-first.
 * Returns [] when LASTFM_API_KEY is unset or no matches are found.
 */
export async function queryCarouselDiscos(): Promise<ProcessedDisco[]> {
  try {
  const topArtists = await fetchTopArtists();
  if (topArtists.length === 0) return [];

  const lastfmSlugs = new Set(topArtists.map(slugifyArtist));

  // Fetch all distinct artist names from available deals (small payload)
  const dbArtists = await prisma.$queryRaw<{ artista: string }[]>`
    SELECT DISTINCT artista FROM "Disco" WHERE disponivel = TRUE
 AND  (format IS NULL OR format = 'vinyl')
  `;

  // One representative DB artista string per unique slug — prevents duplicate
  // carousel cards when the same artist appears as both "X" and "Y, X" forms.
  const slugToArtista = new Map<string, string>();
  for (const { artista } of dbArtists) {
    const s = slugifyArtist(artista);
    if (lastfmSlugs.has(s) && !slugToArtista.has(s)) {
      slugToArtista.set(s, artista);
    }
  }

  const matchedArtistas = [...slugToArtista.values()];
  if (matchedArtistas.length === 0) return [];

  // Best deal per matched artist, then sorted globally best-deal-first.
  const rows = await prisma.$queryRaw<CarouselRow[]>`
    WITH best_per_artist AS (
      SELECT DISTINCT ON (d.artista)
        d.id,
        d.titulo,
        d.artista,
        d.slug,
        d.estilo,
        d."imgUrl",
        d.url,
        d.marketplace,
        d.rating::text            AS rating,
        d."reviewCount"::text     AS "reviewCount",
        d.deal_score              AS "dealScore",
        d.confidence_level        AS "confidenceLevel",
        d.last_crawled_at         AS "lastCrawledAt",
        d.lastfm_tags             AS "lastfmTags",
        hp_latest."precoBrl"                                          AS "precoAtual",
        COALESCE(d.avg_30d::float, hp_latest."precoBrl")              AS "mediaPreco",
        (
          SELECT COALESCE(json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"), '[]'::json)
          FROM (
            SELECT "precoBrl", "capturadoEm"
            FROM   "HistoricoPreco"
            WHERE  "discoId" = d.id
              AND  "capturadoEm" >= NOW() - INTERVAL '30 days'
            ORDER  BY "capturadoEm" DESC
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
      WHERE  d.disponivel = TRUE
      AND  (d.format IS NULL OR d.format = 'vinyl')
        AND  d.price_count >= 5
        AND  d.artista = ANY(${matchedArtistas})
      ORDER  BY d.artista,
               d.deal_score DESC NULLS LAST,
               (COALESCE(d.avg_30d::float, hp_latest."precoBrl") - hp_latest."precoBrl")
               / NULLIF(COALESCE(d.avg_30d::float, hp_latest."precoBrl"), 0) DESC NULLS LAST
    )
    SELECT
      *,
      CASE WHEN "mediaPreco" > 0
        THEN ("mediaPreco" - "precoAtual") / "mediaPreco"
        ELSE 0
      END AS desconto
    FROM   best_per_artist
    ORDER  BY desconto DESC NULLS LAST, "dealScore" DESC NULLS LAST
    LIMIT  40
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
      marketplace:     row.marketplace,
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

// Two-layer cache:
//   - fetchTopArtists() inside is cached 1 week under the `lastfm` tag.
//   - This outer cache is keyed under `prices` so crawler webhook invalidations
//     refresh deal data while keeping the artist lineup stable for a week.
//   - 30-minute TTL fallback if the webhook never fires.
export const queryCarouselDiscosWithCache = unstable_cache(
  queryCarouselDiscos,
  ["carousel-discos"],
  // Also tagged `deals`: the in-loop deal refresh purges this surface every ~30min.
  { tags: ["prices", "deals"], revalidate: 14400 },
);

// Shared artist matching — cached 1 week under `lastfm` tag.
async function fetchMatchedTopArtistNames(): Promise<string[]> {
  const topArtists = await fetchTopArtists();
  if (topArtists.length === 0) return [];

  const lastfmSlugs = new Set(topArtists.map(slugifyArtist));
  const dbArtists = await prisma.$queryRaw<{ artista: string }[]>`
    SELECT DISTINCT artista FROM "Disco" WHERE disponivel = TRUE
 AND  (format IS NULL OR format = 'vinyl')
  `;

  const slugToArtista = new Map<string, string>();
  for (const { artista } of dbArtists) {
    const s = slugifyArtist(artista);
    if (lastfmSlugs.has(s) && !slugToArtista.has(s)) {
      slugToArtista.set(s, artista);
    }
  }
  return [...slugToArtista.values()];
}

export const getMatchedTopArtistNamesWithCache = unstable_cache(
  fetchMatchedTopArtistNames,
  ["top-artist-names"],
  { tags: ["lastfm"], revalidate: 604800 },
);

const PER_PAGE = 24;

type AllDealsRow = CarouselRow & { totalCount: string };

async function queryTopArtistAllDeals(
  page: number,
  sort: string,
  precoMax: number | null,
  // Static page render passes a large pageSize so sort/filter/pagination can
  // run client-side (keeps the route ISR-cacheable — no server searchParams).
  pageSize: number = PER_PAGE,
): Promise<{ items: ProcessedDisco[]; total: number }> {
  try {
    const matchedArtistas = await getMatchedTopArtistNamesWithCache();
    if (matchedArtistas.length === 0) return { items: [], total: 0 };

    const offset      = (page - 1) * pageSize;
    const orderBy     = buildOrderBy(sort);
    const precoFilter = precoMax !== null
      ? Prisma.sql`AND hp_latest."precoBrl"::float <= ${precoMax}`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<AllDealsRow[]>`
      SELECT
        d.id,
        d.titulo,
        d.artista,
        d.slug,
        d.estilo,
        d."imgUrl",
        d.url,
        d.marketplace,
        d.rating::text            AS rating,
        d."reviewCount"::text     AS "reviewCount",
        d.deal_score              AS "dealScore",
        d.confidence_level        AS "confidenceLevel",
        d.last_crawled_at         AS "lastCrawledAt",
        d.lastfm_tags             AS "lastfmTags",
        hp_latest."precoBrl"::float                                AS "precoAtual",
        COALESCE(d.avg_30d::float, hp_latest."precoBrl"::float)    AS "mediaPreco",
        CASE WHEN COALESCE(d.avg_30d::float, hp_latest."precoBrl"::float) > 0
          THEN (COALESCE(d.avg_30d::float, hp_latest."precoBrl"::float) - hp_latest."precoBrl"::float)
               / COALESCE(d.avg_30d::float, hp_latest."precoBrl"::float)
          ELSE 0::float
        END                                                        AS desconto,
        (
          SELECT COALESCE(json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"), '[]'::json)
          FROM (
            SELECT "precoBrl", "capturadoEm"
            FROM   "HistoricoPreco"
            WHERE  "discoId" = d.id
              AND  "capturadoEm" >= NOW() - INTERVAL '30 days'
            ORDER  BY "capturadoEm" DESC
            LIMIT  10
          ) sp
        ) AS sparkline,
        COUNT(*) OVER()::text AS "totalCount"
      FROM   "Disco" d
      INNER JOIN LATERAL (
        SELECT "precoBrl"
        FROM   "HistoricoPreco"
        WHERE  "discoId" = d.id
        ORDER  BY "capturadoEm" DESC
        LIMIT  1
      ) hp_latest ON true
      WHERE  d.disponivel = TRUE
      AND  (d.format IS NULL OR d.format = 'vinyl')
        AND  d.price_count >= 5
        AND  d.artista = ANY(${matchedArtistas})
        ${precoFilter}
      ORDER  BY ${orderBy}
      LIMIT  ${pageSize} OFFSET ${offset}
    `;

    const total = rows.length > 0 ? Number(rows[0].totalCount) : 0;

    const items = rows.flatMap((row): ProcessedDisco[] => {
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
        marketplace:     row.marketplace,
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

    return { items, total };
  } catch {
    return { items: [], total: 0 };
  }
}

export const queryTopArtistAllDealsWithCache = unstable_cache(
  queryTopArtistAllDeals,
  ["top-artist-all-deals"],
  { tags: ["prices"], revalidate: 14400 },
);
