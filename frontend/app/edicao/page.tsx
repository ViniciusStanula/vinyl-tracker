import Link from "next/link";
import { HubHeader, HubTile } from "@/components/hub/HubUI";
import { getEdicoesList } from "@/lib/db/edicaoVinil";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Edições Especiais de Vinil | Garimpa Vinil",
  description:
    "Vinil por tipo de edição: picture disc, box set, Record Store Day, numerado e mais, cada um com histórico de preços de 12 meses na Amazon Brasil.",
  alternates: { canonical: "/edicao" },
  openGraph: {
    title: "Edições Especiais de Vinil | Garimpa Vinil",
    description: "Explore discos de vinil por tipo de edição especial.",
    url: "/edicao",
    type: "website",
    images: ["/og-default.png"],
  },
};

export default async function EdicaoIndexPage() {
  let edicoes: Awaited<ReturnType<typeof getEdicoesList>> = [];
  try {
    edicoes = await getEdicoesList();
  } catch {
    // DB unavailable
  }

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Edições", item: `${SITE_URL}/edicao` },
    ],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Edições</span>
      </nav>

      <HubHeader
        eyebrow="Por edição"
        title="Edições Especiais"
        description={
          edicoes.length > 0
            ? `${edicoes.length} tipos de edição especial de vinil monitorados na Amazon Brasil, com histórico de preços de 12 meses.`
            : "Discos de vinil agrupados pelo tipo de edição especial na Amazon Brasil."
        }
      />

      {edicoes.length === 0 ? (
        <p className="text-dust text-sm">Nenhuma edição disponível no momento.</p>
      ) : (
        // At most eight edition types, so the mosaic is the whole page — the
        // same call /decadas makes at its size. Ordered by catalogue depth.
        <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {edicoes.map((e, i) => (
            <li key={e.slug}>
              <HubTile
                href={`/edicao/${e.slug}`}
                label={e.label}
                count={e.discoCount}
                badge={i === 0 ? "Mais discos" : undefined}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
