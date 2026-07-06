import { queryTopArtistAllDealsWithCache } from "@/lib/db/carousel";
import { PEER_ORIGIN } from "@/lib/hreflang";
import DiscoCard from "@/components/DiscoCard";
import Pagination from "@/components/Pagination";
import SortBar from "@/components/SortBar";
import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { toJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Artistas mais Ouvidos — Garimpa Vinil",
  description:
    "Os artistas mais ouvidos do mundo com as melhores ofertas em discos de vinil na Amazon Brasil.",
  alternates: {
    canonical: "/artistas-mais-ouvidos",
    languages: {
      "pt-BR": "/artistas-mais-ouvidos",
      "en-US": `${PEER_ORIGIN}/top-artists`,
      "x-default": `${PEER_ORIGIN}/top-artists`,
    },
  },
  openGraph: {
    title: "Artistas mais Ouvidos — Garimpa Vinil",
    description:
      "Os artistas mais ouvidos do mundo com as melhores ofertas em discos de vinil na Amazon Brasil.",
    url: "/artistas-mais-ouvidos",
    type: "website",
    images: ["/og-default.png"],
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

  // Kick off the (cached) query without awaiting, so the h1 + intro ship in the
  // shell. The header count and the grid both await this one promise — a single
  // DB call — and stream in via <Suspense>.
  const dataPromise = queryTopArtistAllDealsWithCache(page, sort, precoMax)
    .catch(() => ({ items: [], total: 0 } as Awaited<ReturnType<typeof queryTopArtistAllDealsWithCache>>));

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Artistas Mais Ouvidos", item: `${SITE_URL}/artistas-mais-ouvidos` },
    ],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
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
          <Suspense fallback={null}>
            <ArtistDiscosCount data={dataPromise} />
          </Suspense>
        </p>
      </header>

      <div className="sticky top-[62px] z-40 mb-3 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      <Suspense fallback={<ArtistDiscosSkeleton />}>
        <ArtistDiscosResults
          data={dataPromise}
          page={page}
          sortParam={sortParam}
          precoMaxParam={precoMaxParam}
        />
      </Suspense>
    </div>
  );
}

type ArtistDeals = Awaited<ReturnType<typeof queryTopArtistAllDealsWithCache>>;

async function ArtistDiscosCount({ data }: { data: Promise<ArtistDeals> }) {
  const { total } = await data;
  if (total <= 0) return null;
  return <span className="ml-1 text-dust">({total} discos)</span>;
}

async function ArtistDiscosResults({
  data, page, sortParam, precoMaxParam,
}: {
  data: Promise<ArtistDeals>;
  page: number;
  sortParam?: string;
  precoMaxParam?: string;
}) {
  const { items, total } = await data;
  const totalPages = Math.ceil(total / PER_PAGE);

  if (items.length === 0) {
    return <p className="text-dust text-sm">Nenhum resultado disponível no momento.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {items.map((disco, i) => (
          <li key={disco.id}>
            <DiscoCard disco={disco} priority={i < 10} />
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          searchParams={{ sort: sortParam, precoMax: precoMaxParam }}
          basePath="/artistas-mais-ouvidos"
        />
      )}
    </>
  );
}

/* Fallback shown while the grid streams — mirrors the old loading.tsx grid. */
function ArtistDiscosSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {Array.from({ length: 15 }).map((_, i) => (
        <div
          key={i}
          className="bg-sleeve border border-groove rounded-xl overflow-hidden animate-pulse"
        >
          <div className="aspect-square bg-label" />
          <div className="p-4 space-y-2">
            <div className="h-2.5 bg-groove rounded w-1/2" />
            <div className="h-3.5 bg-groove rounded" />
            <div className="h-3.5 bg-groove rounded w-3/4" />
            <div className="h-5 bg-wax/40 rounded w-1/3 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
