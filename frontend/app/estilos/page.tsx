import Link from "next/link";
import EstilosBrowser, { type EstiloItem } from "@/components/EstilosBrowser";
import { getEstilosList, getEstiloDisplayName } from "@/lib/db/estilo";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Estilos Musicais em Vinil | Garimpa Vinil",
  description:
    "Explore discos de vinil por estilo musical na Amazon Brasil. Rock, Jazz, MPB, Blues e muito mais — cada estilo com histórico de preços de 12 meses.",
  alternates: { canonical: "/estilos" },
  openGraph: {
    title: "Estilos Musicais em Vinil | Garimpa Vinil",
    description:
      "Explore discos de vinil por estilo musical na Amazon Brasil.",
    url: "/estilos",
    type: "website",
    images: ["/og-default.png"],
  },
};

/** Entries listed in this hub's ItemList JSON-LD. */
const HUB_LIST_CAP = 100;

export default async function EstilosIndexPage() {
  let estilos: Awaited<ReturnType<typeof getEstilosList>> = [];
  try {
    estilos = await getEstilosList();
  } catch {
    // DB unavailable
  }

  // Resolve display names server-side so the browser component ships plain data.
  const items: EstiloItem[] = estilos.map((e) => ({
    slug: e.slug,
    nome: getEstiloDisplayName(e.tag),
    count: e.discoCount,
  }));

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início",  item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Estilos", item: `${SITE_URL}/estilos` },
    ],
  });

  // The hub's own links, as a list. These pages carried a breadcrumb and
  // nothing else, so the markup said a page existed here and never that it
  // indexes the whole facet — the counts and destinations were visible to a
  // reader and invisible to a parser.
  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Estilos musicais em vinil",
    url: `${SITE_URL}/estilos`,
    numberOfItems: items.length,
    // numberOfItems stays the true total; the entries themselves are capped.
    // Listing all 688 styles cost 77KB of markup on one page — a parser needs
    // the shape of the list and the count, not every row, and the visible page
    // and the sitemap both still carry the full set.
    itemListElement: items.slice(0, HUB_LIST_CAP).map((e, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: e.nome,
      url: `${SITE_URL}/estilo/${e.slug}`,
    })),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Estilos</span>
      </nav>

      {estilos.length === 0 ? (
        <>
          <header className="mb-8">
            <span className="font-mono text-gold text-[11px] font-medium uppercase tracking-[0.18em] block mb-2">
              Por gênero
            </span>
            <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
              Explorar Estilos
            </h1>
          </header>
          <p className="text-dust text-sm">Nenhum estilo disponível no momento.</p>
        </>
      ) : (
        <EstilosBrowser estilos={items} />
      )}
    </div>
  );
}
