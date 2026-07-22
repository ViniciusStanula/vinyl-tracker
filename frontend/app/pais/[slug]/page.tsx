import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import GuiasRelacionados from "@/components/GuiasRelacionados";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getPaisPageData, type SerializedPaisData } from "@/lib/db/pais";
import { SLUG_TO_ISO2, getPaisDisplayName } from "@/lib/paises";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// [] = nothing prebuilt; each country is rendered + CDN-cached on first request.
// Sort/filter/pagination run client-side (ArtistaRecords) so no server
// searchParams force the route dynamic.
export function generateStaticParams() {
  return [];
}

const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const iso2 = SLUG_TO_ISO2[slug];
  if (!iso2) return { title: "País | Garimpa Vinil", robots: { index: false, follow: false } };

  const nome = getPaisDisplayName(iso2)!;
  const data = await getPaisPageData(iso2).catch(() => null);
  const total = data?.total ?? 0;
  const noindex = total <= 3;

  const title = truncateTitle(`Discos de Vinil de Artistas ${nome === "Brasil" ? "do Brasil" : `de ${nome}`} — Ofertas | Garimpa Vinil`);
  const description = truncateDesc(
    total >= 4
      ? `${total} discos de vinil de artistas de ${nome} com preço monitorado diariamente na Amazon. Ordene por desconto real sobre a média, não promoção inventada.`
      : `Discos de vinil de artistas de ${nome} com preço monitorado diariamente na Amazon. Veja o histórico de 12 meses antes de comprar.`
  );
  const firstImage = data?.discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  const canonicalUrl = `${SITE_URL}/pais/${slug}`;

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

export default async function PaisPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const iso2 = SLUG_TO_ISO2[slug];
  if (!iso2) notFound();

  let data: SerializedPaisData | null = null;
  try {
    data = await getPaisPageData(iso2);
  } catch (err) {
    console.error("[PaisPage] getPaisPageData failed for slug=%s", slug);
    if (process.env.NODE_ENV === "development") console.error(err);
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-parchment text-lg font-semibold mb-2">
          Erro ao carregar página de país
        </p>
        <p className="text-dust text-sm">Tente novamente em alguns instantes.</p>
      </div>
    );
  }
  if (!data || data.total === 0) notFound();

  const nome = getPaisDisplayName(iso2)!;
  const { discos, total } = data;

  const discosProcessados = discos.map((disco) => {
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
      { "@type": "ListItem", position: 2, name: "Países", item: `${siteUrl}/paises` },
      { "@type": "ListItem", position: 3, name: nome, item: `${siteUrl}/pais/${slug}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos de vinil de artistas de ${nome}`,
    url: `${siteUrl}/pais/${slug}`,
    numberOfItems: total,
    itemListElement: discos.slice(0, 10).map((disco, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/disco/${disco.slug}`,
      name: disco.titulo,
    })),
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <Link href="/paises" className="hover:text-cream transition-colors">Países</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">{nome}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-cream">
          Discos de {nome}
        </h1>
        <p className="mt-1 text-dust text-sm">{formatDiscoCount(total)}</p>
      </header>

      {discosProcessados.length > 0 ? (
        <section aria-labelledby="discos-pais-heading">
          <h2 id="discos-pais-heading" className="sr-only">Discos de artistas de {nome} em vinil</h2>
          <ArtistaRecords items={discosProcessados} slug={slug} basePath="/pais" />
        </section>
      ) : (
        <section aria-label="Sem resultados" className="text-center py-24 text-dust">
          <p className="font-display text-parchment text-lg font-semibold mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-dust text-sm">Tente ajustar os filtros.</p>
        </section>
      )}

      <GuiasRelacionados className="mt-8" />

      <BackToTop />
    </div>
  );
}
