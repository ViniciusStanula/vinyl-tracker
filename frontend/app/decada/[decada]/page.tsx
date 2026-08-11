import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ArtistaRecords from "@/components/ArtistaRecords";
import FacetHubs from "@/components/FacetHubs";
import FacetIntro from "@/components/FacetIntro";
import { getFacetStats } from "@/lib/db/facetStats";
import { queryDiscosWithCache } from "@/lib/queryDiscos";
import { toJsonLd } from "@/lib/jsonld";
import { SITE_URL } from "@/lib/siteUrl";
import { DECADES, decadaLabel as label, parseDecade } from "@/lib/decadas";

export const revalidate = 14400;

// Top-N cap: fetch the decade's best records (default desconto sort) in one
// shot so client-side sort/filter/pagination (ArtistaRecords) is instant and
// the route stays ISR-cacheable — no server searchParams.
const RECORDS_CAP = 240;

export function generateStaticParams() {
  return DECADES.map((d) => ({ decada: String(d) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ decada: string }>;
}): Promise<Metadata> {
  const { decada } = await params;
  const start = parseDecade(decada);
  if (start === null) return {};
  const title = `Discos de Vinil dos ${label(start)} — Ofertas | Garimpa Vinil`;
  const description = `Discos de vinil lançados nos ${label(start)} (${start}–${start + 9}) na Amazon Brasil, com preço atual e histórico de 12 meses. Ordene pelo maior desconto.`;
  return {
    title,
    description,
    alternates: { canonical: `/decada/${start}` },
    openGraph: { title, description, url: `/decada/${start}`, type: "website", images: ["/og-default.png"] },
  };
}

export default async function DecadaPage({
  params,
}: {
  params: Promise<{ decada: string }>;
}) {
  const { decada } = await params;
  const start = parseDecade(decada);
  if (start === null) notFound();

  // Top records, default sort, no filter → static/cacheable; ArtistaRecords
  // does sort/filter/pagination in the browser.
  const [{ items, total }, stats] = await Promise.all([
    queryDiscosWithCache({
      searchTerm: "",
      sort: "desconto",
      precoMax: null,
      page: 1,
      decade: start,
      pageSize: RECORDS_CAP,
    }),
    getFacetStats("decada", String(start)).catch(() => null),
  ]);
  if (total === 0) notFound();

  const jsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Vinis dos ${label(start)}`,
    url: `${SITE_URL}/decada/${start}`,
    numberOfItems: total,
    itemListElement: items.slice(0, 10).map((d, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/disco/${d.slug}`,
      name: d.tituloSeo || d.titulo,
    })),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">Vinis dos {label(start)}</span>
      </nav>

      <header className="mb-5">
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          Vinis dos {label(start)}
        </h1>
        <p className="mt-1 text-dust text-sm">
          Lançados entre {start} e {start + 9}
          {total > 0 && <span> · {total} discos</span>}
        </p>
      </header>

      <nav aria-label="Outras décadas" className="flex flex-wrap gap-2 mb-5">
        {DECADES.map((d) => (
          <Link
            key={d}
            href={`/decada/${d}`}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              d === start
                ? "border-gold text-gold"
                : "border-groove text-dust hover:text-cream hover:border-dust"
            }`}
          >
            {label(d)}
          </Link>
        ))}
      </nav>

      {stats && (
        <FacetIntro
          stats={stats}
          sujeito={`Os ${stats.total.toLocaleString("pt-BR")} vinis dos ${label(start)}`}
          mostrarAno={false}
          className="mb-5"
        />
      )}

      {items.length === 0 ? (
        <p className="text-dust text-sm py-12 text-center">Nenhum disco encontrado nesta década com os filtros atuais.</p>
      ) : (
        <ArtistaRecords items={items} slug={String(start)} basePath="/decada" />
      )}

      <FacetHubs atual="decadas" className="mt-10" />
    </div>
  );
}
