import Link from "next/link";
import { getPaisesList } from "@/lib/db/pais";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400;

export const metadata: Metadata = {
  title: "Discos de Vinil por País de Origem | Garimpa Vinil",
  description:
    "Explore discos de vinil pelo país de origem do artista. Estados Unidos, Reino Unido, Brasil e mais — cada país com histórico de preços de 12 meses na Amazon Brasil.",
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

      <header className="mb-8">
        <span className="text-gold text-[11px] font-bold uppercase tracking-[0.2em] block mb-3">
          Por Origem
        </span>
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          Países de Origem
        </h1>
        <p className="mt-1 text-dust text-sm">
          {paises.length > 0
            ? `${paises.length.toLocaleString("pt-BR")} países com discos de vinil monitorados na Amazon Brasil`
            : "Discos de vinil por país de origem do artista na Amazon Brasil"}
        </p>
      </header>

      {paises.length === 0 ? (
        <p className="text-dust text-sm">Nenhum país disponível no momento.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {paises.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/pais/${p.slug}`}
                className="group inline-flex flex-col items-start px-3 py-2 rounded-xl bg-sleeve border border-groove hover:border-wax/70 hover:bg-groove hover:-translate-y-0.5 transition-all"
              >
                <span className="text-parchment text-sm font-medium">{p.nome}</span>
                <span className="text-dust text-xs tabular-nums group-hover:text-gold transition-colors">
                  {p.discoCount.toLocaleString("pt-BR")} discos
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
