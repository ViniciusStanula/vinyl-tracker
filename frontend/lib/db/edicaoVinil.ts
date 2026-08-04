import { prisma } from "./prisma";
import { unstable_cache } from "next/cache";

// vinil_edicao (crawler/titulo_seo.py) stores an exact edition label like
// "Picture Disc" or "Record Store Day" -- unlike vinil_cor there's no
// compound/simplified form, so every match here is exact.
const EDITION_SLUGS: Record<string, string> = {
  "picture-disc": "Picture Disc",
  "edicao-de-aniversario": "Edição de Aniversário",
  "edicao-deluxe": "Edição Deluxe",
  numerado: "Numerado",
  "record-store-day": "Record Store Day",
  "edicao-especial": "Edição Especial",
  "box-set": "Box Set",
  zoetrope: "Zoetrope",
};

export function resolveEditionSlug(slug: string): string | null {
  return EDITION_SLUGS[slug.toLowerCase()] ?? null;
}

export function allEditionSlugs(): string[] {
  return Object.keys(EDITION_SLUGS);
}

const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Inverse of resolveEditionSlug -- turns a stored vinil_edicao value
 * ("Picture Disc") into its hub page slug ("picture-disc"), for the ficha
 * técnica link. */
export function slugifyEdition(edicao: string): string {
  return edicao
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

type EditionRow = {
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
};

export type EdicaoVinilPageData = {
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

const RECORDS_CAP = 240;
const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

const _getEdicaoVinilPageData = unstable_cache(
  async (editionSlug: string): Promise<EdicaoVinilPageData | null> => {
    const label = resolveEditionSlug(editionSlug);
    if (!label) return null;

    const countQuery = prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total
      FROM "Disco" c
      WHERE c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        AND c.vinil_edicao = ${label}
    `;

    const rowsQuery = prisma.$queryRaw<EditionRow[]>`
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
        c.rating::text AS rating,
        c."reviewCount"::text AS "reviewCount",
        c.deal_score AS "dealScore",
        c.confidence_level AS "confidenceLevel",
        c.last_crawled_at AS "lastCrawledAt",
        hp_latest.preco AS "precoAtual",
        COALESCE(c.avg_30d::float, hp_latest.preco) AS "mediaPreco",
        CASE
          WHEN COALESCE(c.avg_30d::float, 0) > 0
          THEN (COALESCE(c.avg_30d::float, hp_latest.preco) - hp_latest.preco)
               / COALESCE(c.avg_30d::float, hp_latest.preco)
          ELSE 0
        END AS desconto,
        (
          SELECT COALESCE(json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"), '[]'::json)
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
      WHERE c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        AND c.vinil_edicao = ${label}
      ORDER BY desconto DESC NULLS LAST, c.deal_score DESC NULLS LAST
      LIMIT ${RECORDS_CAP}
    `;

    const [countResult, rows] = await Promise.all([countQuery, rowsQuery]);
    const total = Number(countResult[0].total);

    const discos = rows.map((row) => {
      const crawledAt = row.lastCrawledAt ? new Date(row.lastCrawledAt).getTime() : null;
      const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
      const dealScore = row.dealScore !== null && !dealIsStale ? row.dealScore : null;
      let sparkline: number[] = [];
      if (Array.isArray(row.sparkline)) {
        sparkline = (row.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
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
        rating: row.rating,
        reviewCount: row.reviewCount !== null ? Number(row.reviewCount) : null,
        precoAtual: Number(row.precoAtual),
        mediaPreco: Number(row.mediaPreco),
        desconto: Number(row.desconto),
        sparkline,
        dealScore,
        confidenceLevel: row.confidenceLevel,
        lastCrawledAt: row.lastCrawledAt ? row.lastCrawledAt.toISOString() : null,
      };
    });

    return { label, total, discos };
  },
  ["edicao-vinil-page-data"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getEdicaoVinilPageData = (editionSlug: string) =>
  _getEdicaoVinilPageData(editionSlug);
