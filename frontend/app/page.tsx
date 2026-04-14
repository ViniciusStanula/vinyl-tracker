import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import GridFadeIn from "@/components/GridFadeIn";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

// Configurable page size — change this constant to adjust across the whole app
export const PAGE_SIZE = 25;

export const metadata = {
  title: "Garimpa Vinil — Melhores ofertas em discos de vinil",
  description:
    "Os melhores descontos em discos de vinil na Amazon Brasil. Histórico de preços atualizado 2× ao dia.",
};

type Sort = "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

type DiscoRow = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: unknown;
  precoAtual: unknown;
  mediaPreco: unknown;
  totalPrecos: unknown;
  desconto: unknown; // computed in CTE
};

/** Escape LIKE meta-characters in user-supplied text. */
function likePct(term: string): string {
  return `%${term.replace(/[%_\\]/g, "\\$&")}%`;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    artista?: string;
    page?: string;
  }>;
}) {
  const {
    q,
    sort = "desconto",
    artista,
    page: pageStr,
  } = await searchParams;

  const page = Math.max(1, parseInt(pageStr ?? "1", 10));
  const searchTerm = q?.trim() ?? "";

  // ── WHERE fragments ────────────────────────────────────────────────────────
  // Values interpolated into Prisma.sql are parameterised (safe from injection).
  const whereSearch = searchTerm
    ? Prisma.sql`AND (d.titulo ILIKE ${likePct(searchTerm)} OR d.artista ILIKE ${likePct(searchTerm)})`
    : Prisma.sql``;

  const whereArtista = artista
    ? Prisma.sql`AND d.artista = ${artista}`
    : Prisma.sql``;

  // ── ORDER BY (mapped from a fixed enum — no injection risk) ────────────────
  const orderByClause = ((): Prisma.Sql => {
    switch (sort as Sort) {
      case "menor-preco": return Prisma.sql`"precoAtual" ASC`;
      case "maior-preco": return Prisma.sql`"precoAtual" DESC`;
      case "avaliados":   return Prisma.sql`COALESCE(rating::numeric, 0) DESC`;
      case "az":          return Prisma.sql`titulo ASC`;
      case "desconto":
      default:            return Prisma.sql`desconto DESC NULLS LAST`;
    }
  })();

  // ── Run count + data queries in parallel ───────────────────────────────────
  const [countResult, rows] = await Promise.all([
    // COUNT: only discos that have at least one price record
    prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total
      FROM   "Disco" d
      INNER JOIN LATERAL (
        SELECT 1 FROM "HistoricoPreco" WHERE "discoId" = d.id LIMIT 1
      ) hp_check ON true
      WHERE  TRUE ${whereSearch} ${whereArtista}
    `,

    // DATA: paginated, sorted, with discount computed in-DB
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
          hp_latest."precoBrl"                              AS "precoAtual",
          COALESCE(hp_avg.media, hp_latest."precoBrl")      AS "mediaPreco",
          COALESCE(hp_avg.cnt, 0)::INTEGER                  AS "totalPrecos"
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
        WHERE TRUE ${whereSearch} ${whereArtista}
      )
      SELECT
        *,
        CASE WHEN "mediaPreco" > 0
          THEN ("mediaPreco" - "precoAtual") / "mediaPreco"
          ELSE 0
        END AS desconto
      FROM  base
      ORDER BY ${orderByClause}
      LIMIT  ${PAGE_SIZE}
      OFFSET ${(page - 1) * PAGE_SIZE}
    `,
  ]);

  const total = Number(countResult[0].total);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const processados = rows.map((row) => {
    const precoAtual = Number(row.precoAtual);
    const mediaPreco = Number(row.mediaPreco);
    const totalPrecos = Number(row.totalPrecos);
    const desconto = Number(row.desconto);
    return {
      ...row,
      rating:
        row.rating !== null && row.rating !== undefined
          ? Number(row.rating)
          : null,
      precoAtual,
      emPromocao: totalPrecos >= 3 && desconto >= 0.1,
      desconto,
    };
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Hero */}
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">
          Melhores ofertas em discos de vinil
        </h1>
        <p className="mt-1 text-zinc-500 text-sm">
          Os melhores descontos em discos de vinil da Amazon
        </p>
      </header>

      {/* Sort bar */}
      <div className="mb-4">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {/* Result count + active artist badge */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <p className="text-zinc-500 text-sm">
          {total === 0
            ? "Nenhum disco encontrado"
            : `${total} ${total === 1 ? "disco encontrado" : "discos encontrados"}`}
          {searchTerm && (
            <span className="text-zinc-400">
              {" "}para{" "}
              <span className="text-zinc-200">&ldquo;{q}&rdquo;</span>
            </span>
          )}
        </p>
        {artista && (
          <span className="inline-flex items-center gap-1.5 bg-zinc-800 text-zinc-200 text-xs px-3 py-1 rounded-full">
            {artista}
            <Link
              href="/"
              className="text-zinc-500 hover:text-zinc-200 transition-colors leading-none"
              aria-label="Remover filtro de artista"
            >
              ×
            </Link>
          </span>
        )}
      </div>

      {/* Grid — keyed on filter+page state so GridFadeIn remounts on each change */}
      {processados.length > 0 ? (
        <GridFadeIn
          key={`${sort}-${q ?? ""}-${artista ?? ""}-${currentPage}`}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {processados.map((disco, index) => (
              <DiscoCard key={disco.id} disco={disco} priority={index < 6} />
            ))}
          </div>
        </GridFadeIn>
      ) : (
        <div className="text-center py-24 text-zinc-600">
          <p className="text-4xl mb-4">🎵</p>
          <p>Nenhum disco encontrado.</p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={{ q, sort, artista }}
        />
      )}
    </main>
  );
}
