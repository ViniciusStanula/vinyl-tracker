import Link from "next/link";
import { HubCard, HubHeader, HubTile, SectionRule } from "@/components/hub/HubUI";
import { getGravadorasList } from "@/lib/db/gravadora";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

const FEATURED_COUNT = 5;

export const metadata: Metadata = {
  title: "Discos de Vinil por Gravadora | Garimpa Vinil",
  description:
    "Discos de vinil pelo selo que os lançou: Blue Note, Music On Vinyl, Columbia e mais, cada um com histórico de preços de 12 meses na Amazon Brasil.",
  alternates: { canonical: "/gravadoras" },
  openGraph: {
    title: "Discos de Vinil por Gravadora | Garimpa Vinil",
    description: "Explore discos de vinil pelo selo que os lançou.",
    url: "/gravadoras",
    type: "website",
    images: ["/og-default.png"],
  },
};

export default async function GravadorasIndexPage() {
  let gravadoras: Awaited<ReturnType<typeof getGravadorasList>> = [];
  try {
    gravadoras = await getGravadorasList();
  } catch {
    // DB unavailable
  }

  // getGravadorasList already returns descending by disco count.
  const featured = gravadoras.slice(0, FEATURED_COUNT);
  const rest = gravadoras.slice(FEATURED_COUNT);

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Gravadoras", item: `${SITE_URL}/gravadoras` },
    ],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Gravadoras</span>
      </nav>

      <HubHeader
        eyebrow="Por selo"
        title="Gravadoras"
        description={
          gravadoras.length > 0
            ? `${gravadoras.length.toLocaleString("pt-BR")} selos com catálogo em vinil monitorado na Amazon Brasil, com histórico de preços de 12 meses.`
            : "Discos de vinil pelo selo que os lançou na Amazon Brasil."
        }
      />

      {gravadoras.length === 0 ? (
        <p className="text-dust text-sm">Nenhuma gravadora disponível no momento.</p>
      ) : (
        <>
          {featured.length === FEATURED_COUNT && (
            <section aria-label="Gravadoras com mais discos" className="mb-10 sm:mb-14">
              <div className="grid gap-4 lg:grid-cols-2">
                <HubTile
                  href={`/gravadora/${featured[0].slug}`}
                  label={featured[0].label}
                  count={featured[0].discoCount}
                  badge="Mais discos"
                  featured
                />
                <div className="grid grid-cols-2 gap-4">
                  {featured.slice(1).map((g) => (
                    <HubTile
                      key={g.slug}
                      href={`/gravadora/${g.slug}`}
                      label={g.label}
                      count={g.discoCount}
                    />
                  ))}
                </div>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <section aria-labelledby="todas-gravadoras">
              <SectionRule
                id="todas-gravadoras"
                title="Todas as gravadoras"
                subtitle={`${gravadoras.length} selos`}
              />
              <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {rest.map((g) => (
                  <li key={g.slug}>
                    <HubCard
                      href={`/gravadora/${g.slug}`}
                      label={g.label}
                      count={g.discoCount}
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
