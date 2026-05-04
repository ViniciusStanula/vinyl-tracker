import { queryDiscos } from "@/lib/queryDiscos";
import { formatDiscoCount } from "@/lib/formatters";
import SortBar from "@/components/SortBar";
import InfiniteGrid from "@/components/InfiniteGrid";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { Suspense } from "react";

export const revalidate = 300;

export const metadata = {
  title: "Todos os Discos — Garimpa Vinil",
  description:
    "Todos os discos de vinil em promoção na Amazon Brasil. Filtre por preço, artista e ordenação.",
  alternates: { canonical: "/disco" },
  openGraph: {
    title: "Todos os Discos — Garimpa Vinil",
    description:
      "Todos os discos de vinil em promoção na Amazon Brasil. Filtre por preço, artista e ordenação.",
    url: "/disco",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Todos os Discos — Garimpa Vinil",
    description:
      "Todos os discos de vinil em promoção na Amazon Brasil. Filtre por preço, artista e ordenação.",
  },
};

export default async function DiscosPage({
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

  let items: Awaited<ReturnType<typeof queryDiscos>>["items"] = [];
  let total = 0, totalPages = 0;
  try {
    ({ items, total, totalPages } = await queryDiscos({ searchTerm, sort, artista, precoMax, page }));
  } catch {
    // DB unavailable — render empty state
  }

  const currentPage = Math.min(page, totalPages);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">

      <h1 className="font-display text-3xl font-bold text-cream mb-6">
        Todos os Discos
      </h1>

      {/* ── Sort bar ────────────────────────────────────────────── */}
      <div className="mb-5">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {/* ── Result count + active filters ───────────────────────── */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <p className="text-dust text-sm">
          {formatDiscoCount(total)}
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
              href="/disco"
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
              <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
              <circle cx="32" cy="32" r="20" className="fill-record" opacity="0.8" />
              <circle cx="32" cy="32" r="5"  className="fill-gold" opacity="0.4" />
              <circle cx="32" cy="32" r="2"  className="fill-record" />
            </svg>
          </div>
          <p className="font-display text-parchment text-lg font-semibold mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-dust text-sm mb-6">
            Tente ajustar os filtros ou buscar por outro artista.
          </p>
          <Link
            href="/disco"
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
