import Link from "next/link";
import { HubHeader, HubTile } from "@/components/hub/HubUI";
import { getDecadasList } from "@/lib/db/decada";
import { decadaLabel } from "@/lib/decadas";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Discos de Vinil por Década | Garimpa Vinil",
  description:
    "Explore discos de vinil por década de lançamento. Anos 50 a anos 20 — cada década com histórico de preços de 12 meses na Amazon Brasil.",
  alternates: { canonical: "/decadas" },
  openGraph: {
    title: "Discos de Vinil por Década | Garimpa Vinil",
    description: "Explore discos de vinil por década de lançamento.",
    url: "/decadas",
    type: "website",
    images: ["/og-default.png"],
  },
};

export default async function DecadasIndexPage() {
  let decadas: Awaited<ReturnType<typeof getDecadasList>> = [];
  try {
    decadas = await getDecadasList();
  } catch {
    // DB unavailable
  }

  const topDecada = decadas.length
    ? decadas.reduce((best, d) => (d.discoCount > best.discoCount ? d : best)).start
    : null;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Décadas", item: `${SITE_URL}/decadas` },
    ],
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Décadas</span>
      </nav>

      <HubHeader
        eyebrow="Por década"
        title="Discos por Década"
        description={`Discos de vinil agrupados pela década de lançamento${
          decadas.length > 0 ? `, das mais antigas às mais recentes — ${decadas.length} décadas monitoradas` : ""
        } na Amazon Brasil.`}
      />

      {/* Only eight decades, so the mosaic is the whole page — no filter or
          A–Z index, which would be noise at this size. Ordered newest first;
          the decade with the most records carries the badge. */}
      <ul className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {decadas.map((d) => (
          <li key={d.start}>
            <HubTile
              href={`/decada/${d.start}`}
              label={decadaLabel(d.start)}
              count={d.discoCount}
              badge={d.start === topDecada ? "Mais discos" : undefined}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
