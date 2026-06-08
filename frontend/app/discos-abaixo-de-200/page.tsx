import { queryPriceUnder200WithCache } from "@/lib/db/promos";
import { PEER_ORIGIN } from "@/lib/hreflang";
import DiscoCard from "@/components/DiscoCard";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import type { Metadata } from "next";

export const revalidate = 1800;

export const metadata: Metadata = {
  title: "Discos de Vinil abaixo de R$ 200 — Garimpa Vinil",
  description:
    "Todos os discos de vinil disponíveis por menos de R$ 200 na Amazon Brasil, ordenados pelas melhores ofertas.",
  alternates: {
    canonical: "/discos-abaixo-de-200",
    languages: {
      "pt-BR": "/discos-abaixo-de-200",
      "en-US": `${PEER_ORIGIN}/records-under-200`,
      "x-default": `${PEER_ORIGIN}/records-under-200`,
    },
  },
  openGraph: {
    title: "Discos de Vinil abaixo de R$ 200 — Garimpa Vinil",
    description:
      "Todos os discos de vinil disponíveis por menos de R$ 200 na Amazon Brasil, ordenados pelas melhores ofertas.",
    url: "/discos-abaixo-de-200",
    type: "website",
  },
};

const PAGE_SIZE = 40;

export default async function DiscosAbaixo200Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageStr } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  let items: Awaited<ReturnType<typeof queryPriceUnder200WithCache>> = [];
  try {
    items = await queryPriceUnder200WithCache();
  } catch {
    // DB unavailable
  }

  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safePage   = Math.min(currentPage, totalPages);
  const start      = (safePage - 1) * PAGE_SIZE;
  const pageItems  = items.slice(start, start + PAGE_SIZE);

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      <header className="mb-8">
        <Link
          href="/"
          className="text-parchment hover:text-gold text-sm transition-colors mb-4 inline-block"
        >
          ← Início
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-cream leading-tight">
          Discos abaixo de R$ 200
        </h1>
        <p className="mt-2 text-parchment text-sm max-w-md">
          {totalItems > 0
            ? `${totalItems} discos disponíveis por menos de R$ 200, ordenados pelas melhores ofertas.`
            : "Nenhum disco disponível no momento."}
        </p>
      </header>

      {pageItems.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {pageItems.map((disco, i) => (
              <DiscoCard key={disco.id} disco={disco} priority={i < 10} />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={safePage}
              totalPages={totalPages}
              searchParams={{}}
              basePath="/discos-abaixo-de-200"
            />
          )}
        </>
      )}
    </main>
  );
}
