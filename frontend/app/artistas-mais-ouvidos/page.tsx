import { queryTopArtistAllDealsWithCache } from "@/lib/db/carousel";
import DiscoCard from "@/components/DiscoCard";
import Pagination from "@/components/Pagination";
import SortBar from "@/components/SortBar";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Artistas mais Ouvidos — Garimpa Vinil",
  description:
    "Os artistas mais ouvidos do mundo com as melhores ofertas em discos de vinil na Amazon Brasil.",
  alternates: { canonical: "/artistas-mais-ouvidos" },
  openGraph: {
    title: "Artistas mais Ouvidos — Garimpa Vinil",
    description:
      "Os artistas mais ouvidos do mundo com as melhores ofertas em discos de vinil na Amazon Brasil.",
    url: "/artistas-mais-ouvidos",
    type: "website",
  },
};

const PER_PAGE = 24;

export default async function ArtistasPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; precoMax?: string }>;
}) {
  const { page: pageParam, sort: sortParam, precoMax: precoMaxParam } = await searchParams;
  const page     = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const sort     = sortParam ?? "desconto";
  const precoMax = precoMaxParam ? Number(precoMaxParam) : null;

  let items: Awaited<ReturnType<typeof queryTopArtistAllDealsWithCache>>["items"] = [];
  let total = 0;
  try {
    ({ items, total } = await queryTopArtistAllDealsWithCache(page, sort, precoMax));
  } catch {
    // DB unavailable
  }

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-4">
        <Link
          href="/"
          className="text-parchment hover:text-gold text-sm transition-colors mb-4 inline-block"
        >
          ← Início
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight [text-wrap:balance]">
          Artistas mais Ouvidos
        </h1>
        <p className="mt-2 text-parchment text-sm max-w-md">
          Todos os discos dos artistas do top mundial, ordenados por oferta.
          {total > 0 && (
            <span className="ml-1 text-dust">({total} discos)</span>
          )}
        </p>
      </header>

      <div className="sticky top-[62px] z-40 mb-3 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {items.length === 0 ? (
        <p className="text-dust text-sm">Nenhum resultado disponível no momento.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((disco, i) => (
              <DiscoCard key={disco.id} disco={disco} priority={i < 10} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              searchParams={{ sort: sortParam, precoMax: precoMaxParam }}
              basePath="/artistas-mais-ouvidos"
            />
          )}
        </>
      )}
    </main>
  );
}
