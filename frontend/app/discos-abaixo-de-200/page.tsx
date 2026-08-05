import { queryPriceUnder200WithCache } from "@/lib/db/promos";
import ArtistaRecords from "@/components/ArtistaRecords";
import Link from "next/link";
import type { Metadata } from "next";
import { toJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 14400;

export async function generateMetadata(): Promise<Metadata> {
  let count = 0;
  try {
    count = (await queryPriceUnder200WithCache()).length;
  } catch {
    // DB unavailable — fall back to generic description
  }
  const title = "Discos de Vinil abaixo de R$ 200 | Garimpa Vinil";
  const description = count > 0
    ? `${count.toLocaleString("pt-BR")} discos de vinil por menos de R$ 200 na Amazon, ordenados pelo desconto sobre a média histórica de preço.`
    : "Discos de vinil por menos de R$ 200 na Amazon, ordenados pelo desconto sobre a média histórica de preço.";
  return {
    title,
    description,
    alternates: {
      canonical: "/discos-abaixo-de-200",
    },
    openGraph: {
      title,
      description,
      url: "/discos-abaixo-de-200",
      type: "website",
      images: ["/og-default.png"],
    },
  };
}

// Reading no searchParams keeps the route static/ISR-cacheable; pagination
// (plus sort/price filter) runs client-side in ArtistaRecords.
export default async function DiscosAbaixo200Page() {
  let items: Awaited<ReturnType<typeof queryPriceUnder200WithCache>> = [];
  try {
    items = await queryPriceUnder200WithCache();
  } catch {
    // DB unavailable
  }

  const totalItems = items.length;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Discos de Vinil Abaixo de R$ 200", item: `${SITE_URL}/discos-abaixo-de-200` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Discos de Vinil Abaixo de R$ 200",
    url: `${SITE_URL}/discos-abaixo-de-200`,
    numberOfItems: totalItems,
    itemListElement: items.slice(0, 10).map((disco, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/disco/${disco.slug}`,
      name: disco.tituloSeo || disco.titulo,
    })),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
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

      {items.length > 0 && (
        <ArtistaRecords items={items} slug="discos-abaixo-de-200" basePath="" />
      )}
    </div>
  );
}
