import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";

// vinil_cor (crawler/titulo_seo.py) stores a short display label like
// "Vermelho" or a compound "Azul / Rosa" when two colors are both real, or a
// simplified "Multicor" / "Splatter Colorido" / "Colorido" when 3+ colors or
// only a generic "colored" claim exists. Single-color slugs match via
// substring so they also catch compound values that include them; the three
// simplified labels are exact matches only, since e.g. "Colorido" must not
// swallow "Splatter Colorido"'s records too.
//
// MUST cover every label crawler/titulo_seo.py's COLOR_MAP can produce.
// These two lists drifted out of sync once already -- this one was
// hand-typed against an earlier, shorter version of COLOR_MAP and silently
// missed 17 labels added since (Translúcido: 532 records, Mesclado: 364,
// Opaco: 180, Splatter: 140, Violeta: 76, and 12 smaller ones), each
// producing a real 404 on an existing color hub URL until it was reported.
// Keys are the accent-stripped, lowercase, space-to-hyphen slug; values
// match Python's str.capitalize() exactly (only the first character
// uppercased), since that's what compose() actually stores in vinil_cor for
// multi-word labels ("Branco osso", not "Branco Osso").
const SIMPLE_COLOR_SLUGS: Record<string, string> = {
  vermelho: "Vermelho",
  azul: "Azul",
  "azul-petroleo": "Azul-petróleo",
  bordo: "Bordô",
  branco: "Branco",
  "branco-osso": "Branco osso",
  chocolate: "Chocolate",
  cinza: "Cinza",
  cobre: "Cobre",
  coral: "Coral",
  creme: "Creme",
  dourado: "Dourado",
  laranja: "Laranja",
  lilas: "Lilás",
  magenta: "Magenta",
  marrom: "Marrom",
  mesclado: "Mesclado",
  opaco: "Opaco",
  osso: "Osso",
  platina: "Platina",
  prateado: "Prateado",
  preto: "Preto",
  rosa: "Rosa",
  roxo: "Roxo",
  splatter: "Splatter",
  translucido: "Translúcido",
  transparente: "Transparente",
  "transparente-leitoso": "Transparente leitoso",
  turquesa: "Turquesa",
  uva: "Uva",
  verde: "Verde",
  "verde-oliva": "Verde-oliva",
  violeta: "Violeta",
  "agua-marinha": "Água-marinha",
  onix: "Ônix",
};

const EXACT_COLOR_SLUGS: Record<string, string> = {
  multicor: "Multicor",
  "splatter-colorido": "Splatter Colorido",
  colorido: "Colorido",
};

export function resolveColorSlug(slug: string): { label: string; exact: boolean } | null {
  const lower = slug.toLowerCase();
  if (lower in EXACT_COLOR_SLUGS) return { label: EXACT_COLOR_SLUGS[lower], exact: true };
  if (lower in SIMPLE_COLOR_SLUGS) return { label: SIMPLE_COLOR_SLUGS[lower], exact: false };
  return null;
}

export function allColorSlugs(): string[] {
  return [...Object.keys(SIMPLE_COLOR_SLUGS), ...Object.keys(EXACT_COLOR_SLUGS)];
}

// Unicode combining-diacritical-marks block, written as an escape rather than
// literal characters -- pasting the actual combining marks into source is
// what corrupted the previous version of this function.
const COMBINING_MARKS_RE = new RegExp("[\\u0300-\\u036f]", "g");

/** Inverse of resolveColorSlug's label lookup -- turns a stored vinil_cor
 * value ("Azul", "Splatter Colorido", "Azul / Rosa") into the hub page slug
 * for the ficha técnica link. A compound value links via its first color;
 * the hub page's substring match still lists the record either way. */
export function slugifyColor(cor: string): string {
  const primeira = cor.split(" / ")[0];
  return primeira
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .toLowerCase()
    .replace(/\s+/g, "-");
}

type ColorRow = {
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

export type VinilColoridoPageData = {
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

const _getVinilColoridoPageData = unstable_cache(
  async (colorSlug: string): Promise<VinilColoridoPageData | null> => {
    const resolved = resolveColorSlug(colorSlug);
    if (!resolved) return null;
    const { label, exact } = resolved;

    // Same conditional-fragment style as estilo.ts's wherePrecoMax: build the
    // SQL piece in JS, splice it into the template, rather than trying to
    // parameterize the branch itself.
    const whereColor = exact
      ? Prisma.sql`c.vinil_cor = ${label}`
      : Prisma.sql`c.vinil_cor ILIKE ${"%" + label + "%"}`;

    const countQuery = prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total
      FROM "Disco" c
      WHERE c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        AND ${whereColor}
    `;

    const rowsQuery = prisma.$queryRaw<ColorRow[]>`
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
        AND ${whereColor}
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
  ["vinil-colorido-page-data"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getVinilColoridoPageData = (colorSlug: string) =>
  _getVinilColoridoPageData(colorSlug);
