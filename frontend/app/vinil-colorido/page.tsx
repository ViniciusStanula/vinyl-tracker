import Link from "next/link";
import { HubCard, HubHeader, HubTile, SectionRule } from "@/components/hub/HubUI";
import { getCoresList } from "@/lib/db/vinilColorido";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

const FEATURED_COUNT = 5;

export const metadata: Metadata = {
  title: "Discos de Vinil Colorido por Cor | Garimpa Vinil",
  description:
    "Explore discos de vinil pela cor do disco. Vermelho, azul, translúcido, splatter e mais — cada cor com histórico de preços de 12 meses na Amazon Brasil.",
  alternates: { canonical: "/vinil-colorido" },
  openGraph: {
    title: "Discos de Vinil Colorido por Cor | Garimpa Vinil",
    description: "Explore discos de vinil pela cor do disco.",
    url: "/vinil-colorido",
    type: "website",
    images: ["/og-default.png"],
  },
};

/** Entries listed in this hub's ItemList JSON-LD. */
const HUB_LIST_CAP = 100;

export default async function VinilColoridoIndexPage() {
  let cores: Awaited<ReturnType<typeof getCoresList>> = [];
  try {
    cores = await getCoresList();
  } catch {
    // DB unavailable
  }

  // getCoresList already returns descending by disco count.
  const featured = cores.slice(0, FEATURED_COUNT);
  const rest = cores.slice(FEATURED_COUNT);

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Vinil Colorido", item: `${SITE_URL}/vinil-colorido` },
    ],
  });

  // The hub's own links, as a list. These pages carried a breadcrumb and
  // nothing else, so the markup said a page existed here and never that it
  // indexes the whole facet — the counts and destinations were visible to a
  // reader and invisible to a parser.
  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Cores de vinil",
    url: `${SITE_URL}/vinil-colorido`,
    numberOfItems: cores.length,
    // numberOfItems stays the true total; the entries themselves are capped.
    // Listing all 688 styles cost 77KB of markup on one page — a parser needs
    // the shape of the list and the count, not every row, and the visible page
    // and the sitemap both still carry the full set.
    itemListElement: cores.slice(0, HUB_LIST_CAP).map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      url: `${SITE_URL}/vinil-colorido/${c.slug}`,
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
        <span className="text-parchment">Vinil Colorido</span>
      </nav>

      <HubHeader
        eyebrow="Por cor"
        title="Vinil Colorido"
        description={
          cores.length > 0
            ? `${cores.length.toLocaleString("pt-BR")} cores de vinil monitoradas na Amazon Brasil, com histórico de preços de 12 meses.`
            : "Discos de vinil agrupados pela cor do disco na Amazon Brasil."
        }
      />

      {cores.length === 0 ? (
        <p className="text-dust text-sm">Nenhuma cor disponível no momento.</p>
      ) : (
        <>
          {/* Same mosaic-then-cards shape as /paises. Colors below four records
              are filtered out by getCoresList, since their hub page is noindex. */}
          {featured.length === FEATURED_COUNT && (
            <section aria-label="Cores com mais discos" className="mb-10 sm:mb-14">
              <div className="grid gap-4 lg:grid-cols-2">
                <HubTile
                  href={`/vinil-colorido/${featured[0].slug}`}
                  label={featured[0].label}
                  count={featured[0].discoCount}
                  badge="Mais discos"
                  featured
                />
                <div className="grid grid-cols-2 gap-4">
                  {featured.slice(1).map((c) => (
                    <HubTile
                      key={c.slug}
                      href={`/vinil-colorido/${c.slug}`}
                      label={c.label}
                      count={c.discoCount}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section aria-labelledby="todas-cores">
              <SectionRule
                id="todas-cores"
                title="Todas as cores"
                subtitle={`${cores.length} cores`}
              />
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {rest.map((c) => (
                  <li key={c.slug}>
                    <HubCard
                      href={`/vinil-colorido/${c.slug}`}
                      label={c.label}
                      count={c.discoCount}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-10 text-sm text-dust">
            Antes de escolher pela cor, veja{" "}
            <Link href="/guias/vinil-colorido-e-picture-disc" className="text-gold hover:underline">
              o que muda no som entre vinil preto, colorido e picture disc
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
