import Link from "next/link";
import { HubCard, HubHeader, HubTile, SectionRule } from "@/components/hub/HubUI";
import { getPaisesList } from "@/lib/db/pais";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

const FEATURED_COUNT = 5;

export const metadata: Metadata = {
  title: "Discos de Vinil por País de Origem | Garimpa Vinil",
  description:
    "Discos de vinil pelo país de origem do artista: Estados Unidos, Reino Unido, Brasil e mais, cada um com histórico de preços de 12 meses na Amazon.",
  alternates: { canonical: "/paises" },
  openGraph: {
    title: "Discos de Vinil por País de Origem | Garimpa Vinil",
    description: "Explore discos de vinil pelo país de origem do artista.",
    url: "/paises",
    type: "website",
    images: ["/og-default.png"],
  },
};

export default async function PaisesIndexPage() {
  let paises: Awaited<ReturnType<typeof getPaisesList>> = [];
  try {
    paises = await getPaisesList();
  } catch {
    // DB unavailable
  }

  // getPaisesList already returns descending by disco count.
  const featured = paises.slice(0, FEATURED_COUNT);
  const rest = paises.slice(FEATURED_COUNT);

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Países", item: `${SITE_URL}/paises` },
    ],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Países</span>
      </nav>

      <HubHeader
        eyebrow="Por origem"
        title="Países de Origem"
        description={
          paises.length > 0
            ? `${paises.length.toLocaleString("pt-BR")} países de origem com discos de vinil monitorados na Amazon Brasil, com histórico de preços de 12 meses.`
            : "Discos de vinil por país de origem do artista na Amazon Brasil."
        }
      />

      {paises.length === 0 ? (
        <p className="text-dust text-sm">Nenhum país disponível no momento.</p>
      ) : (
        <>
          {/* Mosaic of the five deepest catalogues, then everything else as
              cards. 42 countries fit on one screen, so no filter or A–Z index. */}
          {featured.length === FEATURED_COUNT && (
            <section aria-label="Países com mais discos" className="mb-10 sm:mb-14">
              <div className="grid gap-4 lg:grid-cols-2">
                <HubTile
                  href={`/pais/${featured[0].slug}`}
                  label={featured[0].nome}
                  count={featured[0].discoCount}
                  badge="Mais discos"
                  featured
                />
                <div className="grid grid-cols-2 gap-4">
                  {featured.slice(1).map((p) => (
                    <HubTile
                      key={p.slug}
                      href={`/pais/${p.slug}`}
                      label={p.nome}
                      count={p.discoCount}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section aria-labelledby="todos-paises">
              <SectionRule
                id="todos-paises"
                title="Todos os países"
                subtitle={`${paises.length} origens`}
              />
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {rest.map((p) => (
                  <li key={p.slug}>
                    <HubCard
                      href={`/pais/${p.slug}`}
                      label={p.nome}
                      count={p.discoCount}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
