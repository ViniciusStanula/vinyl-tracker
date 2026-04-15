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
    const totalPrecos = Number(row.totalPrecos);
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

    return {
      id:        row.id,
      slug:      row.slug,
      titulo:    row.titulo,
      artista:   row.artista,
      estilo:    row.estilo,
      imgUrl:    row.imgUrl,
      url:       row.url,
      rating:      row.rating !== null && row.rating !== undefined ? Number(row.rating) : null,
      reviewCount: row.reviewCount !== null && row.reviewCount !== undefined ? Number(row.reviewCount) : null,
      precoAtual,
      mediaPreco,
      emPromocao: totalPrecos >= 3 && desconto >= 0.1,
      desconto,
      sparkline,
    };
  });

  return { items, total, totalPages };
}
