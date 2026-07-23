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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

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
