import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import FacetHubs from "@/components/FacetHubs";
import FacetIntro from "@/components/FacetIntro";
import { getFacetStats } from "@/lib/db/facetStats";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getVinilColoridoPageData, resolveColorSlug, allColorSlugs } from "@/lib/db/vinilColorido";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";
import type { ProcessedDisco } from "@/lib/queryDiscos";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// All color slugs are a small, finite set (~23) -- prebuild every one rather
// than ranking by bot_hits like /estilo does for its much larger tag space.
export async function generateStaticParams() {
  return allColorSlugs().map((cor) => ({ cor }));
}

const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ cor: string }>;
}): Promise<Metadata> {
  const { cor } = await params;
  const resolved = resolveColorSlug(cor);
  if (!resolved) return { title: "Vinil Colorido | Garimpa Vinil" };

  const data = await getVinilColoridoPageData(cor).catch(() => null);
  if (!data) return { title: "Vinil Colorido | Garimpa Vinil" };

  const { label, total } = data;
  const noindex = total <= 3;

  const title = truncateTitle(`Discos em Vinil ${label} — Ofertas | Garimpa Vinil`);
  const description = truncateDesc(
    total >= 4
      ? `${total.toLocaleString("pt-BR")} discos prensados em vinil ${label.toLowerCase()} na Amazon Brasil, com histórico de preço de 12 meses e o desconto real sobre a média.`
      : `Discos em vinil ${label.toLowerCase()} com preço monitorado diariamente na Amazon. Veja o histórico de 12 meses antes de comprar.`
  );
  const firstImage = data.discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  const canonicalUrl = `${SITE_URL}/vinil-colorido/${cor}`;

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

export default async function VinilColoridoPage({
  params,
}: {
  params: Promise<{ cor: string }>;
}) {
  const { cor } = await params;
  if (!resolveColorSlug(cor)) notFound();

  const [data, stats] = await Promise.all([
    getVinilColoridoPageData(cor).catch(() => null),
    getFacetStats("cor", cor).catch(() => null),
  ]);
  if (!data) notFound();
  const { label, total, discos } = data;

  const discosProcessados: ProcessedDisco[] = discos.map((disco) => {
    const crawledAt = disco.lastCrawledAt ? new Date(disco.lastCrawledAt).getTime() : null;
    const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
    const dealScore = disco.dealScore !== null && !dealIsStale ? disco.dealScore : null;
    return {
      ...disco,
      rating: disco.rating ? Number(disco.rating) : null,
      emPromocao: dealScore !== null,
      dealScore,
      historyDays: null,
      lastfmTags: null,
      disponivel: true,
    };
  });

  const siteUrl = SITE_URL;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Vinil Colorido", item: `${siteUrl}/vinil-colorido` },
      { "@type": "ListItem", position: 3, name: label, item: `${siteUrl}/vinil-colorido/${cor}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos em Vinil ${label}`,
    url: `${siteUrl}/vinil-colorido/${cor}`,
    numberOfItems: total,
    itemListElement: discos.slice(0, 10).map((disco, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/disco/${disco.slug}`,
      name: disco.tituloSeo || disco.titulo,
    })),
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
          <Link href="/vinil-colorido" className="hover:text-cream transition-colors">
            Vinil Colorido
          </Link>
          <span aria-hidden="true">›</span>
          <span className="text-parchment">Vinil {label}</span>
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
            sujeito={`Os ${stats.total.toLocaleString("pt-BR")} discos prensados em vinil ${label.toLowerCase()}`}
            className="mb-6"
          />
        )}

        {discosProcessados.length > 0 ? (
          <section aria-labelledby="discos-cor-heading">
            <h2 id="discos-cor-heading" className="sr-only">Discos em vinil {label.toLowerCase()}</h2>
            <ArtistaRecords items={discosProcessados} slug={cor} basePath="/vinil-colorido" />
          </section>
        ) : (
          <section aria-label="Sem resultados" className="text-center py-24 text-dust">
            <div className="inline-block mb-5 opacity-40">
              <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto">
                <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
              </svg>
            </div>
            <p className="font-display text-parchment text-lg font-semibold mb-1">Nenhum disco encontrado</p>
            <p className="text-sm">Ainda não há discos em vinil {label.toLowerCase()} catalogados.</p>
          </section>
        )}
        <FacetHubs atual="vinil-colorido" className="mt-10" />
      </div>
      <BackToTop />
    </>
  );
}
