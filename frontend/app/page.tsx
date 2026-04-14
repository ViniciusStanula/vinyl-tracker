import { prisma } from "@/lib/prisma";
import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import GridFadeIn from "@/components/GridFadeIn";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

export const metadata = {
  title: "Garimpa Vinil — Melhores ofertas em discos de vinil",
  description:
    "Os melhores descontos em discos de vinil na Amazon Brasil. Histórico de preços atualizado 2× ao dia.",
};

type Sort = "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

// Raw row returned by the aggregating SQL query.
// $queryRaw returns PostgreSQL numerics as strings and booleans as-is.
type DiscoRow = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: unknown; // Prisma Decimal → comes as string from raw queries
  precoAtual: unknown; // PostgreSQL NUMERIC → string
  mediaPreco: unknown; // PostgreSQL NUMERIC → string
  totalPrecos: unknown; // INTEGER
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; artista?: string }>;
}) {
  const { q, sort = "desconto", artista } = await searchParams;

  // Single SQL query: one row per disco, aggregates computed in the DB.
  // Replaces the previous findMany + include:{precos:{take:60}} which
  // transferred ~60 rows per disco (300K+ rows for 5K discos).
  const rows = await prisma.$queryRaw<DiscoRow[]>`
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
    FROM "Disco" d
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
  `;

  const processados = rows.map((row) => {
    const precoAtual = Number(row.precoAtual);
    const mediaPreco = Number(row.mediaPreco);
    const totalPrecos = Number(row.totalPrecos);
    const desconto = mediaPreco > 0 ? (mediaPreco - precoAtual) / mediaPreco : 0;
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

  // Filter
  const lowerQ = q?.toLowerCase().trim() ?? "";
  const filtered = processados.filter((d) => {
    const matchQ =
      !lowerQ ||
      d.titulo.toLowerCase().includes(lowerQ) ||
      d.artista.toLowerCase().includes(lowerQ);
    const matchArtista = !artista || d.artista === artista;
    return matchQ && matchArtista;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sort as Sort) {
      case "menor-preco":
        return a.precoAtual - b.precoAtual;
      case "maior-preco":
        return b.precoAtual - a.precoAtual;
      case "avaliados":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "az":
        return a.titulo.localeCompare(b.titulo, "pt-BR");
      case "desconto":
      default:
        return b.desconto - a.desconto;
    }
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
          {sorted.length === 0
            ? "Nenhum disco encontrado"
            : `${sorted.length} ${sorted.length === 1 ? "disco encontrado" : "discos encontrados"}`}
          {lowerQ && (
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

      {/* Grid — keyed on filter state so GridFadeIn remounts and plays animation on each change */}
      {sorted.length > 0 ? (
        <GridFadeIn key={`${sort}-${q ?? ""}-${artista ?? ""}`}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sorted.map((disco, index) => (
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
    </main>
  );
}
