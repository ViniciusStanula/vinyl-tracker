import { queryDiscos } from "@/lib/queryDiscos";
import SortBar from "@/components/SortBar";
import InfiniteGrid from "@/components/InfiniteGrid";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 3600;

export const metadata = {
  title: "Garimpa Vinil — Melhores ofertas em discos de vinil",
  description:
    "Os melhores descontos em discos de vinil na Amazon Brasil. Histórico de preços atualizado 2× ao dia.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    sort?: string;
    artista?: string;
    page?: string;
    precoMax?: string;
  }>;
}) {
  const {
    q,
    sort = "desconto",
    artista,
    page: pageStr,
    precoMax: precoMaxStr,
  } = await searchParams;

  const page        = Math.max(1, parseInt(pageStr ?? "1", 10));
  const searchTerm  = q?.trim() ?? "";
  const precoMax    = precoMaxStr ? Number(precoMaxStr) : null;

  const { items, total, totalPages } = await queryDiscos({
    searchTerm,
    sort,
    artista,
    precoMax,
    page,
  });

  const currentPage = Math.min(page, totalPages);

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

      {/* Grid + Pagination / Infinite scroll */}
      {items.length > 0 ? (
        <InfiniteGrid
          initialItems={items}
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={{ q, sort, artista, precoMax: precoMaxStr }}
          animationKey={`${sort}-${q ?? ""}-${artista ?? ""}-${currentPage}`}
        />
      ) : (
        <div className="text-center py-24 text-zinc-600">
          <p className="text-5xl mb-4">🎵</p>
          <p className="text-zinc-400 text-lg font-medium mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-zinc-600 text-sm mb-6">
            Tente ajustar os filtros ou buscar por outro artista.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm px-5 py-2.5 rounded-full transition-colors"
          >
            Ver todos os discos
          </Link>
        </div>
      )}

      <BackToTop />
    </main>
  );
}
