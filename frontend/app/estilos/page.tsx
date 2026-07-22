import Link from "next/link";
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

      <header className="mb-8">
        <span className="text-gold text-[11px] font-bold uppercase tracking-[0.2em] block mb-3">
          Por Gênero
        </span>
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          Estilos Musicais
        </h1>
        <p className="mt-1 text-dust text-sm">
          {estilos.length > 0
            ? `${estilos.length.toLocaleString("pt-BR")} estilos com discos de vinil monitorados na Amazon Brasil`
            : "Estilos musicais com discos de vinil na Amazon Brasil"}
        </p>
      </header>

      {estilos.length === 0 ? (
        <p className="text-dust text-sm">Nenhum estilo disponível no momento.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {estilos.map((e) => {
            const displayName = getEstiloDisplayName(e.tag);
            return (
              <li key={e.slug}>
                <Link
                  href={`/estilo/${e.slug}`}
                  className="group inline-flex flex-col items-start px-3 py-2 rounded-xl bg-sleeve border border-groove hover:border-wax/70 hover:bg-groove hover:-translate-y-0.5 transition-all"
                >
                  <span className="text-parchment text-sm font-medium">{displayName}</span>
                  <span className="text-dust text-xs tabular-nums group-hover:text-gold transition-colors">
                    {e.discoCount.toLocaleString("pt-BR")} discos
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
