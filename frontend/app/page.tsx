import { prisma } from "@/lib/prisma";
import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

export const metadata = {
  title: "Vinil Deals — Melhores ofertas em discos de vinil",
  description:
    "Os melhores descontos em discos de vinil na Amazon Brasil. Histórico de preços atualizado 2× ao dia.",
};

type Sort = "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; artista?: string }>;
}) {
  const { q, sort = "desconto", artista } = await searchParams;

  const discos = await prisma.disco.findMany({
    include: {
      precos: {
        orderBy: { capturadoEm: "desc" },
        take: 60,
      },
    },
  });

  const processados = discos.map((disco) => {
    const precos = disco.precos.map((p) => Number(p.precoBrl));
    const precoAtual = precos[0] ?? 0;
    const media =
      precos.length > 0
        ? precos.reduce((a, b) => a + b, 0) / precos.length
        : precoAtual;
    const desconto = media > 0 ? (media - precoAtual) / media : 0;
    return {
      ...disco,
      rating: disco.rating ? Number(disco.rating) : null,
      precoAtual,
      emPromocao: precos.length >= 3 && desconto >= 0.1,
      desconto,
    };
  });

  // Filter by search query
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

      {/* Grid */}
      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {sorted.map((disco) => (
            <DiscoCard key={disco.id} disco={disco} />
          ))}
        </div>
      ) : (
        <div className="text-center py-24 text-zinc-600">
          <p className="text-4xl mb-4">🎵</p>
          <p>Nenhum disco encontrado.</p>
        </div>
      )}
    </main>
  );
}
