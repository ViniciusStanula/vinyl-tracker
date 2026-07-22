import Link from "next/link";
import { getDecadasList } from "@/lib/db/decada";
import { decadaLabel } from "@/lib/decadas";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Discos de Vinil por Década | Garimpa Vinil",
  description:
    "Explore discos de vinil por década de lançamento. Anos 60 a anos 20 — cada década com histórico de preços de 12 meses na Amazon Brasil.",
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

      <header className="mb-8">
        <span className="text-gold text-[11px] font-bold uppercase tracking-[0.2em] block mb-3">
          Por Década
        </span>
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          Discos por Década
        </h1>
        <p className="mt-1 text-dust text-sm">
          Discos de vinil agrupados pela década de lançamento na Amazon Brasil
        </p>
      </header>

      <ul className="flex flex-wrap gap-2">
        {decadas.map((d) => (
          <li key={d.start}>
            <Link
              href={`/decada/${d.start}`}
              className="group inline-flex flex-col items-start px-3 py-2 rounded-xl bg-sleeve border border-groove hover:border-wax/70 hover:bg-groove hover:-translate-y-0.5 transition-all"
            >
              <span className="text-parchment text-sm font-medium capitalize">{decadaLabel(d.start)}</span>
              <span className="text-dust text-xs tabular-nums group-hover:text-gold transition-colors">
                {d.discoCount.toLocaleString("pt-BR")} discos
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
