import { queryTopArtistAllDealsWithCache } from "@/lib/db/carousel";
import { PEER_ORIGIN } from "@/lib/hreflang";
import ArtistaRecords from "@/components/ArtistaRecords";
import Link from "next/link";
import type { Metadata } from "next";
import { toJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 14400;

// Top-N cap: fetch the best records (default desconto sort) in one shot so
// client-side sort/filter/pagination (ArtistaRecords) is instant and the
// route stays ISR-cacheable — no server searchParams.
const RECORDS_CAP = 240;

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

export default async function ArtistasPage() {
  // Top records, default sort, no filter → static/cacheable; ArtistaRecords
  // does sort/filter/pagination in the browser.
  const { items, total } = await queryTopArtistAllDealsWithCache(1, "desconto", null, RECORDS_CAP)
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
          {total > 0 && <span className="ml-1 text-dust">({total} discos)</span>}
        </p>
      </header>

      {items.length === 0 ? (
        <p className="text-dust text-sm">Nenhum resultado disponível no momento.</p>
      ) : (
        <ArtistaRecords items={items} slug="artistas-mais-ouvidos" basePath="" />
      )}
    </div>
  );
}
