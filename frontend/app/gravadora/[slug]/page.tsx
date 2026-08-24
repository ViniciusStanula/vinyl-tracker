import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import FacetHubs from "@/components/FacetHubs";
import FacetIntro from "@/components/FacetIntro";
import GuiasRelacionados from "@/components/GuiasRelacionados";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getGravadoraData, GRAVADORA_MIN, type GravadoraData } from "@/lib/db/gravadora";
import { getFacetStats } from "@/lib/db/facetStats";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd, discoListItems } from "@/lib/jsonld";
import type { Metadata } from "next";
import type { ProcessedDisco } from "@/lib/queryDiscos";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// [] = nothing prebuilt; each label renders + CDN-caches on first request, the
// same as /pais. Sort/filter/pagination run client-side (ArtistaRecords) so no
// server searchParams force the route dynamic.
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
  const data = await getGravadoraData(slug).catch(() => null);
  if (!data) return { title: "Gravadora | Garimpa Vinil", robots: { index: false, follow: false } };

  const { label, total, discos } = data;
  const noindex = total < GRAVADORA_MIN;

  const title = truncateTitle(`Discos de Vinil da ${label} — Ofertas | Garimpa Vinil`);
  const description = truncateDesc(
    total >= GRAVADORA_MIN
      ? `${total.toLocaleString("pt-BR")} discos de vinil lançados pelo selo ${label} na Amazon Brasil, com preço acompanhado todo dia e histórico de 12 meses.`
      : `Discos de vinil do selo ${label} com preço monitorado diariamente na Amazon. Veja o histórico de 12 meses antes de comprar.`,
  );
  const firstImage = discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  const canonicalUrl = `${SITE_URL}/gravadora/${slug}`;

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

export default async function GravadoraPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let data: GravadoraData | null = null;
  try {
    data = await getGravadoraData(slug);
  } catch (err) {
    console.error("[GravadoraPage] getGravadoraData failed for slug=%s", slug);
    if (process.env.NODE_ENV === "development") console.error(err);
    // Re-thrown, not rendered as a friendly 200: a soft error page is a
    // successful response, so ISR cached it and one transient failure left the
    // route serving a headingless stub until revalidation. app/error.tsx shows
    // the same message on an uncached 500 instead.
    throw err;
  }
  if (!data) notFound();

  const { label, total, discos } = data;
  const stats = await getFacetStats("gravadora", label).catch(() => null);

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

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Gravadoras", item: `${SITE_URL}/gravadoras` },
      { "@type": "ListItem", position: 3, name: label, item: `${SITE_URL}/gravadora/${slug}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos de vinil da ${label}`,
    url: `${SITE_URL}/gravadora/${slug}`,
    numberOfItems: total,
    itemListElement: discoListItems(discos, SITE_URL),
  });

  // The label itself, as an entity. The page is ABOUT a record company and
  // said so nowhere in the markup — only that a list of records existed at
  // this URL. The @id matches the recordLabel node each record page emits
  // inside its MusicRelease, so a consumer reading a record and this hub sees
  // one company rather than two unrelated strings.
  const organizationJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/gravadora/${slug}#organization`,
    name: label,
    url: `${SITE_URL}/gravadora/${slug}`,
  });

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd }} />

        <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
          <Link href="/" className="hover:text-cream transition-colors">Início</Link>
          <span aria-hidden="true">›</span>
          <Link href="/gravadoras" className="hover:text-cream transition-colors">Gravadoras</Link>
          <span aria-hidden="true">›</span>
          <span className="text-parchment">{label}</span>
        </nav>

        <header className="mb-6">
          <h1 className="font-display text-3xl font-bold text-cream [text-wrap:balance]">{label}</h1>
          <p className="mt-1 text-dust text-sm">{formatDiscoCount(total)}</p>
        </header>

        {stats && (
          <FacetIntro
            stats={stats}
            sujeito={`Os ${stats.total.toLocaleString("pt-BR")} discos do selo ${label}`}
            className="mb-6"
          />
        )}

        {discosProcessados.length > 0 ? (
          <section aria-labelledby="discos-gravadora-heading">
            <h2 id="discos-gravadora-heading" className="sr-only">Discos em vinil da {label}</h2>
            <ArtistaRecords items={discosProcessados} slug={slug} basePath="/gravadora" />
          </section>
        ) : (
          <section aria-label="Sem resultados" className="text-center py-24 text-dust">
            <p className="font-display text-parchment text-lg font-semibold mb-1">Nenhum disco encontrado</p>
            <p className="text-sm">Ainda não há discos da {label} catalogados.</p>
          </section>
        )}

        <FacetHubs atual="gravadoras" className="mt-10" />

        <GuiasRelacionados className="mt-8" />
      </div>
      <BackToTop />
    </>
  );
}
