import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import FacetHubs from "@/components/FacetHubs";
import FacetIntro from "@/components/FacetIntro";
import { getFacetStats } from "@/lib/db/facetStats";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getEdicaoVinilPageData, resolveEditionSlug, allEditionSlugs } from "@/lib/db/edicaoVinil";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd, discoListItems } from "@/lib/jsonld";
import type { Metadata } from "next";
import type { ProcessedDisco } from "@/lib/queryDiscos";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// A small, finite set (8 edition types) -- prebuild every one.
export async function generateStaticParams() {
  return allEditionSlugs().map((tipo) => ({ tipo }));
}

const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tipo: string }>;
}): Promise<Metadata> {
  const { tipo } = await params;
  if (!resolveEditionSlug(tipo)) return { title: "Edições Especiais de Vinil | Garimpa Vinil" };

  const data = await getEdicaoVinilPageData(tipo).catch(() => null);
  if (!data) return { title: "Edições Especiais de Vinil | Garimpa Vinil" };

  const { label, total } = data;
  const noindex = total <= 3;

  const title = truncateTitle(`Discos em Vinil ${label} — Ofertas | Garimpa Vinil`);
  const description = truncateDesc(
    total >= 4
      ? `${total.toLocaleString("pt-BR")} edições ${label} em vinil na Amazon Brasil. Veja o histórico de 12 meses de cada uma e compre quando o preço cair de verdade.`
      : `Discos em vinil ${label} com preço monitorado diariamente na Amazon. Veja o histórico de 12 meses antes de comprar.`
  );
  const firstImage = data.discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  const canonicalUrl = `${SITE_URL}/edicao/${tipo}`;

  return {
    title,
    description,
    robots: noindex ? { index: false, follow: true } : undefined,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      title,
      description,
      url: canonicalUrl,
      images: [firstImage ?? `${SITE_URL}/og-default.png`],
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      images: [firstImage ?? `${SITE_URL}/og-default.png`],
    },
  };
}

export default async function EdicaoVinilPage({
  params,
}: {
  params: Promise<{ tipo: string }>;
}) {
  const { tipo } = await params;
  if (!resolveEditionSlug(tipo)) notFound();

  const [data, stats] = await Promise.all([
    getEdicaoVinilPageData(tipo).catch(() => null),
    getFacetStats("edicao", tipo).catch(() => null),
  ]);
  if (!data) notFound();
  const { label, total, discos } = data;

  // Read once, outside the map. Server Component rendered per ISR generation,
  // so the wall-clock read is intended — the purity rule targets client
  // components that re-render.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  const discosProcessados: ProcessedDisco[] = discos.map((disco) => {
    const crawledAt = disco.lastCrawledAt ? new Date(disco.lastCrawledAt).getTime() : null;
    const dealIsStale = crawledAt === null || agora - crawledAt > DEAL_STALE_MS;
    const dealScore = disco.dealScore !== null && !dealIsStale ? disco.dealScore : null;
    // Listed field by field rather than spread: the spread also shipped
    // `lastCrawledAt`, which moves on every crawl even when the price does not,
    // so this page's output changed on every observation and Vercel billed a
    // full ISR write for it. estilo/emPromocao/confidenceLevel/historyDays/
    // lastfmTags have no reader on this route and were pure bytes.
    return {
      id: disco.id,
      slug: disco.slug,
      titulo: disco.titulo,
      tituloSeo: disco.tituloSeo,
      artista: disco.artista,
      imgUrl: disco.imgUrl,
      url: disco.url,
      marketplace: disco.marketplace,
      rating: disco.rating ? Number(disco.rating) : null,
      reviewCount: disco.reviewCount,
      precoAtual: disco.precoAtual,
      mediaPreco: disco.mediaPreco,
      desconto: disco.desconto,
      sparkline: disco.sparkline,
      dealScore,
      disponivel: true,
    };
  });

  const siteUrl = SITE_URL;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Edições Especiais", item: `${siteUrl}/edicao` },
      { "@type": "ListItem", position: 3, name: label, item: `${siteUrl}/edicao/${tipo}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos em Vinil ${label}`,
    url: `${siteUrl}/edicao/${tipo}`,
    numberOfItems: total,
    itemListElement: discoListItems(discos, siteUrl),
  });

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
        {/* eslint-disable-next-line react/no-danger */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
        <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
          <Link href="/" className="hover:text-cream transition-colors">
            Início
          </Link>
          <span aria-hidden="true">›</span>
          <Link href="/edicao" className="hover:text-cream transition-colors">
            Edições Especiais
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-parchment">{label}</span>
        </nav>

        <header className="mb-6">
          <h1 className="font-display text-3xl font-bold text-cream">
            Discos em Vinil {label}
          </h1>
          <p className="mt-1 text-dust text-sm">{formatDiscoCount(total)}</p>
        </header>

        {stats && (
          <FacetIntro
            stats={stats}
            sujeito={`Os ${stats.total.toLocaleString("pt-BR")} discos em vinil ${label.toLowerCase()}`}
            className="mb-6"
          />
        )}

        {discosProcessados.length > 0 ? (
          <section aria-labelledby="discos-edicao-heading">
            <h2 id="discos-edicao-heading" className="sr-only">Discos em vinil {label}</h2>
            <ArtistaRecords items={discosProcessados} slug={tipo} basePath="/edicao" />
          </section>
        ) : (
          <section aria-label="Sem resultados" className="text-center py-24 text-dust">
            <div className="inline-block mb-5 opacity-40">
              <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto">
                <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
              </svg>
            </div>
            <p className="font-display text-parchment text-lg font-semibold mb-1">Nenhum disco encontrado</p>
            <p className="text-sm">Ainda não há discos {label.toLowerCase()} catalogados.</p>
          </section>
        )}
        <FacetHubs atual="edicao" className="mt-10" />
      </div>
      <BackToTop />
    </>
  );
}
