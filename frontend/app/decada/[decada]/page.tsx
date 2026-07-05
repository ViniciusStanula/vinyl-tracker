import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import Pagination from "@/components/Pagination";
import { queryDiscosWithCache } from "@/lib/queryDiscos";
import { toJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 14400;

// Decades we surface as hubs. Slug is the start year; label reads "anos 80".
const DECADES = [1960, 1970, 1980, 1990, 2000, 2010, 2020] as const;

const label = (start: number) => `anos ${String(start).slice(2)}`;

function parseDecade(slug: string): number | null {
  const n = Number(slug);
  return DECADES.includes(n as (typeof DECADES)[number]) ? n : null;
}

export function generateStaticParams() {
  return DECADES.map((d) => ({ decada: String(d) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ decada: string }>;
}): Promise<Metadata> {
  const { decada } = await params;
  const start = parseDecade(decada);
  if (start === null) return {};
  const title = `Vinis dos ${label(start)} — Garimpa Vinil`;
  const description = `Discos de vinil lançados nos ${label(start)} (${start}–${start + 9}) disponíveis na Amazon Brasil, com preço atual e histórico. Filtre e ordene por preço, avaliação ou popularidade.`;
  return {
    title,
    description,
    alternates: { canonical: `/decada/${start}` },
    openGraph: { title, description, url: `/decada/${start}`, type: "website", images: ["/og-default.png"] },
  };
}

export default async function DecadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ decada: string }>;
  searchParams: Promise<{ page?: string; sort?: string; precoMax?: string }>;
}) {
  const { decada } = await params;
  const start = parseDecade(decada);
  if (start === null) notFound();

  const { page: pageParam, sort: sortParam, precoMax: precoMaxParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const sort = sortParam ?? "desconto";
  const precoMax = precoMaxParam ? Number(precoMaxParam) : null;

  const { items, total, totalPages } = await queryDiscosWithCache({
    searchTerm: "",
    sort,
    precoMax,
    page,
    decade: start,
  });
  if (total === 0 && page === 1) notFound();

  const currentPage = Math.min(page, totalPages);

  const jsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Vinis dos ${label(start)}`,
    url: `${SITE_URL}/decada/${start}`,
    numberOfItems: total,
    itemListElement: items.slice(0, 10).map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/disco/${d.slug}`,
      name: d.titulo,
    })),
  });

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Vinis dos {label(start)}</span>
      </nav>

      <header className="mb-5">
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          Vinis dos {label(start)}
        </h1>
        <p className="mt-1 text-dust text-sm">
          Lançados entre {start} e {start + 9}
          {total > 0 && <span> · {total} discos</span>}
        </p>
      </header>

      <nav aria-label="Outras décadas" className="flex flex-wrap gap-2 mb-5">
        {DECADES.map((d) => (
          <Link
            key={d}
            href={`/decada/${d}`}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              d === start
                ? "border-gold text-gold"
                : "border-groove text-dust hover:text-cream hover:border-dust"
            }`}
          >
            {label(d)}
          </Link>
        ))}
      </nav>

      <div className="sticky top-[62px] z-40 mb-4 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {items.length === 0 ? (
        <p className="text-dust text-sm py-12 text-center">Nenhum disco encontrado nesta década com os filtros atuais.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {items.map((disco, i) => (
              <DiscoCard key={disco.id} disco={disco} priority={i < 10} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchParams={{ sort: sortParam, precoMax: precoMaxParam }}
              basePath={`/decada/${start}`}
            />
          )}
        </>
      )}
    </main>
  );
}
