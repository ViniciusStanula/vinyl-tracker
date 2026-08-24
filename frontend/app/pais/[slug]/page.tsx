import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import FacetHubs from "@/components/FacetHubs";
import FacetIntro from "@/components/FacetIntro";
import GuiasRelacionados from "@/components/GuiasRelacionados";
import { getFacetStats } from "@/lib/db/facetStats";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pickTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getPaisPageData, type SerializedPaisData } from "@/lib/db/pais";
import { SLUG_TO_ISO2, getPaisDisplayName, paisComPreposicao } from "@/lib/paises";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd, discoListItems } from "@/lib/jsonld";
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

  // "dos Estados Unidos", "do Japão", "da Alemanha", "de Portugal" — see
  // PAIS_PREPOSICAO. Used identically in the title and the description so the
  // two can't disagree the way "do Brasil" / "de Brasil" used to.
  const doPais = paisComPreposicao(iso2, nome);
  const title = pickTitle([
    `Discos de Vinil de Artistas ${doPais} — Ofertas | Garimpa Vinil`,
    `Discos de Vinil de Artistas ${doPais} — Ofertas`,
    `Discos de Vinil de Artistas ${doPais}`,
    `Vinis ${doPais} — Ofertas`,
  ]);
  const description = truncateDesc(
    total >= 4
      ? `${total.toLocaleString("pt-BR")} discos de vinil de artistas ${doPais} na Amazon, com preço monitorado diariamente e histórico de 12 meses.`
      : `Discos de vinil de artistas ${doPais} com preço monitorado diariamente na Amazon. Veja o histórico de 12 meses antes de comprar.`
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

  const stats = await getFacetStats("pais", slug).catch(() => null);

  const nome = getPaisDisplayName(iso2)!;
  const doPais = paisComPreposicao(iso2, nome);
  const { discos, total } = data;

  // Read once, outside the map. Server Component rendered per ISR generation,
  // so the wall-clock read is intended — the purity rule targets client
  // components that re-render.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  const discosProcessados = discos.map((disco) => {
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
      { "@type": "ListItem", position: 2, name: "Países", item: `${siteUrl}/paises` },
      { "@type": "ListItem", position: 3, name: nome, item: `${siteUrl}/pais/${slug}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos de vinil de artistas ${doPais}`,
    url: `${siteUrl}/pais/${slug}`,
    numberOfItems: total,
    itemListElement: discoListItems(discos, siteUrl),
  });

  // The country as an entity, with the ISO code as its identifier. The artist
  // pages already publish foundingLocation as a Place with the same PT-BR
  // name; this gives that name a node and an ISO code to resolve against
  // instead of leaving it as loose text on both ends.
  const countryJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Country",
    "@id": `${siteUrl}/pais/${slug}#country`,
    name: nome,
    url: `${siteUrl}/pais/${slug}`,
    identifier: {
      "@type": "PropertyValue",
      propertyID: "ISO 3166-1 alpha-2",
      value: iso2,
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: countryJsonLd }} />

      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">Início</Link>
        <span aria-hidden="true">›</span>
        <Link href="/paises" className="hover:text-cream transition-colors">Países</Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">{nome}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-cream">
          Discos {doPais}
        </h1>
        <p className="mt-1 text-dust text-sm">{formatDiscoCount(total)}</p>
      </header>

      {stats && (
        <FacetIntro
          stats={stats}
          sujeito={`Os ${stats.total.toLocaleString("pt-BR")} discos de artistas ${doPais}`}
          className="mb-6"
        />
      )}

      {discosProcessados.length > 0 ? (
        <section aria-labelledby="discos-pais-heading">
          <h2 id="discos-pais-heading" className="sr-only">Discos de artistas {doPais} em vinil</h2>
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

      <FacetHubs atual="paises" className="mt-10" />

      <GuiasRelacionados className="mt-8" />

      <BackToTop />
    </div>
  );
}
