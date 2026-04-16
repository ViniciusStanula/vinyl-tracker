import { queryDiscos } from "@/lib/queryDiscos";
import SortBar from "@/components/SortBar";
import InfiniteGrid from "@/components/InfiniteGrid";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 300;

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

  const page       = Math.max(1, parseInt(pageStr ?? "1", 10));
  const searchTerm = q?.trim() ?? "";
  const precoMax   = precoMaxStr ? Number(precoMaxStr) : null;

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

      {/* ── Hero ────────────────────────────────────────────────── */}
      <header className="relative mb-8 overflow-hidden rounded-2xl bg-sleeve border border-groove px-6 py-7 vinyl-grooves">
        <p className="text-gold text-[10px] font-bold tracking-[0.45em] uppercase mb-3 opacity-90">
          Amazon Brasil · Atualizado 2× ao dia
        </p>
        <h1
          className="text-3xl sm:text-4xl font-black text-cream leading-tight"
          style={{ fontFamily: "var(--font-fraunces, serif)" }}
        >
          Melhores ofertas em
          <br />
          <span className="text-gold">discos de vinil</span>
        </h1>
        <p className="mt-3 text-parchment text-sm max-w-md leading-relaxed">
          Histórico de preços completo. Descubra o melhor momento para comprar.
        </p>
      </header>

      {/* ── Sort bar ────────────────────────────────────────────── */}
      <div className="mb-5">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {/* ── Result count + active artist badge ──────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <p className="text-dust text-sm">
          {total === 0
            ? "Nenhum disco encontrado"
            : `${total} ${total === 1 ? "disco encontrado" : "discos encontrados"}`}
          {searchTerm && (
            <span className="text-parchment">
              {" "}para{" "}
              <span className="text-cream">&ldquo;{q}&rdquo;</span>
            </span>
          )}
        </p>
        {artista && (
          <span className="inline-flex items-center gap-1.5 bg-groove border border-wax/60 text-parchment text-xs px-3 py-1 rounded-full">
            {artista}
            <Link
              href="/"
              className="text-dust hover:text-cream transition-colors leading-none"
              aria-label="Remover filtro de artista"
            >
              ×
            </Link>
          </span>
        )}
      </div>

      {/* ── Grid + Pagination ───────────────────────────────────── */}
      {items.length > 0 ? (
        <InfiniteGrid
          initialItems={items}
          currentPage={currentPage}
          totalPages={totalPages}
          searchParams={{ q, sort, artista, precoMax: precoMaxStr }}
          animationKey={`${sort}-${q ?? ""}-${artista ?? ""}-${currentPage}`}
        />
      ) : (
        <div className="text-center py-24 text-dust">
          <div className="inline-block mb-5 opacity-40">
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto">
              <circle cx="32" cy="32" r="30" fill="#d98f0e" opacity="0.3" />
              <circle cx="32" cy="32" r="20" fill="#0c0a08" opacity="0.8" />
              <circle cx="32" cy="32" r="5"  fill="#d98f0e" opacity="0.4" />
              <circle cx="32" cy="32" r="2"  fill="#0c0a08" />
            </svg>
          </div>
          <p className="text-parchment text-lg font-semibold mb-2"
            style={{ fontFamily: "var(--font-fraunces, serif)" }}
          >
            Nenhum disco encontrado
          </p>
          <p className="text-dust text-sm mb-6">
            Tente ajustar os filtros ou buscar por outro artista.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-2.5 rounded-full transition-colors"
          >
            Ver todos os discos
          </Link>
        </div>
      )}

      <BackToTop />
    </main>
  );
}
