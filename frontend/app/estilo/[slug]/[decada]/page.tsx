import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import FacetHubs from "@/components/FacetHubs";
import FacetIntro from "@/components/FacetIntro";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import {
  getEstiloDecadaData,
  getDecadasForEstilo,
  ESTILO_DECADA_MIN,
  type EstiloDecadaData,
} from "@/lib/db/estiloDecada";
import { getEstiloDisplayName } from "@/lib/db/estilo";
import { getFacetStats } from "@/lib/db/facetStats";
import { decadaLabel, parseDecade } from "@/lib/decadas";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd, discoListItems } from "@/lib/jsonld";
import type { Metadata } from "next";
import type { ProcessedDisco } from "@/lib/queryDiscos";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// Nothing prebuilt: ~900 cells is too many to build up front, and each one
// renders + CDN-caches on first request like /estilo and /pais already do.
// Sort/filter/pagination run client-side (ArtistaRecords) so no server
// searchParams force the route dynamic.
export function generateStaticParams() {
  return [];
}

const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; decada: string }>;
}): Promise<Metadata> {
  const { slug, decada } = await params;
  const start = parseDecade(decada);
  if (start === null) return { title: "Estilo | Garimpa Vinil", robots: { index: false, follow: false } };

  const data = await getEstiloDecadaData(slug, start).catch(() => null);
  if (!data) return { title: "Estilo | Garimpa Vinil", robots: { index: false, follow: false } };

  const { canonical, total, discos } = data;
  const nome = getEstiloDisplayName(canonical);
  const anos = decadaLabel(start);
  // Under the threshold the page is a bare grid — it still resolves, so an
  // existing link never breaks, but it stays out of the index and the sitemap.
  const noindex = total < ESTILO_DECADA_MIN;

  const title = truncateTitle(`${nome} dos ${anos} em Vinil — Ofertas | Garimpa Vinil`);
  const description = truncateDesc(
    `${total.toLocaleString("pt-BR")} discos de ${nome.toLowerCase()} lançados nos ${anos} (${start}–${start + 9}) em vinil na Amazon, com preço acompanhado todo dia e histórico de 12 meses.`,
  );
  const firstImage = discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  const canonicalUrl = `${SITE_URL}/estilo/${slug}/${start}`;

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

export default async function EstiloDecadaPage({
  params,
}: {
  params: Promise<{ slug: string; decada: string }>;
}) {
  const { slug, decada } = await params;
  const start = parseDecade(decada);
  if (start === null) notFound();

  let data: EstiloDecadaData | null = null;
  try {
    data = await getEstiloDecadaData(slug, start);
  } catch (err) {
    console.error("[EstiloDecadaPage] getEstiloDecadaData failed for slug=%s decada=%s", slug, start);
    if (process.env.NODE_ENV === "development") console.error(err);
    return (
      <div className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-parchment text-lg font-semibold mb-2">
          Erro ao carregar página de estilo
        </p>
        <p className="text-dust text-sm">Tente novamente em alguns instantes.</p>
      </div>
    );
  }
  if (!data) notFound();

  const { canonical, total, discos } = data;
  const nome = getEstiloDisplayName(canonical);
  const anos = decadaLabel(start);

  const [stats, irmas] = await Promise.all([
    getFacetStats("estilo-decada", `${canonical}|${start}`).catch(() => null),
    getDecadasForEstilo(slug).catch(() => []),
  ]);

  // Read once, outside the map. This is a Server Component rendered per ISR
  // generation, so a wall-clock read is the intended behaviour here — the
  // purity rule is aimed at client components that re-render.
  // eslint-disable-next-line react-hooks/purity
  const agora = Date.now();

  const discosProcessados: ProcessedDisco[] = discos.map((disco) => {
    const crawledAt = disco.lastCrawledAt ? new Date(disco.lastCrawledAt).getTime() : null;
    const dealIsStale = crawledAt === null || agora - crawledAt > DEAL_STALE_MS;
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

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Estilos", item: `${SITE_URL}/estilos` },
      { "@type": "ListItem", position: 3, name: nome, item: `${SITE_URL}/estilo/${slug}` },
      { "@type": "ListItem", position: 4, name: anos, item: `${SITE_URL}/estilo/${slug}/${start}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos de ${nome} dos ${anos}`,
    url: `${SITE_URL}/estilo/${slug}/${start}`,
    numberOfItems: total,
    itemListElement: discoListItems(discos, SITE_URL),
  });

  // Same genre node the parent /estilo/[slug] page publishes, by @id. These
  // pages named the style only in prose; nothing in the markup said the list
  // was a genre at all, so the decade slices were disconnected from the style
  // hub they belong to.
  const musicGenreJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "MusicGenre",
    "@id": `${SITE_URL}/estilo/${slug}#genre`,
    name: nome,
    url: `${SITE_URL}/estilo/${slug}`,
  });

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: musicGenreJsonLd }} />

        <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
          <Link href="/" className="hover:text-cream transition-colors">Início</Link>
          <span aria-hidden="true">›</span>
          <Link href="/estilos" className="hover:text-cream transition-colors">Estilos</Link>
          <span aria-hidden="true">›</span>
          <Link href={`/estilo/${slug}`} className="hover:text-cream transition-colors">{nome}</Link>
          <span aria-hidden="true">›</span>
          <span className="text-parchment">{anos}</span>
        </nav>

        <header className="mb-5">
          <h1 className="font-display text-3xl font-bold text-cream [text-wrap:balance]">
            {nome} dos {anos}
          </h1>
          <p className="mt-1 text-dust text-sm">
            Lançados entre {start} e {start + 9} · {formatDiscoCount(total)}
          </p>
        </header>

        {/* Sibling decades for the same style — the lateral move a visitor who
            landed on "anos 80" actually wants, and the crawl path into the rest
            of the set. Only decades that cleared the threshold appear. */}
        {irmas.length > 1 && (
          <nav aria-label={`Outras décadas em ${nome}`} className="flex flex-wrap gap-2 mb-5">
            {irmas.map((c) => (
              <Link
                key={c.decada}
                href={`/estilo/${slug}/${c.decada}`}
                className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
                  c.decada === start
                    ? "border-gold text-gold"
                    : "border-groove text-dust hover:text-cream hover:border-dust"
                }`}
              >
                {decadaLabel(c.decada)}
              </Link>
            ))}
          </nav>
        )}

        {stats && (
          <FacetIntro
            stats={stats}
            sujeito={`Os ${stats.total.toLocaleString("pt-BR")} discos de ${nome.toLowerCase()} dos ${anos}`}
            mostrarAno={false}
            className="mb-6"
          />
        )}

        {discosProcessados.length > 0 ? (
          <section aria-labelledby="discos-estilo-decada-heading">
            <h2 id="discos-estilo-decada-heading" className="sr-only">
              Discos de {nome} dos {anos} em vinil
            </h2>
            {/* slug is the parent style, not the cell — ArtistaRecords uses it
                for its "ver todos os discos" link, which should escape the
                decade filter rather than point at this same page. */}
            <ArtistaRecords items={discosProcessados} slug={slug} basePath="/estilo" />
          </section>
        ) : (
          <section aria-label="Sem resultados" className="text-center py-24 text-dust">
            <p className="font-display text-parchment text-lg font-semibold mb-1">Nenhum disco encontrado</p>
            <p className="text-sm">Ainda não há discos de {nome.toLowerCase()} dos {anos} catalogados.</p>
          </section>
        )}

        <p className="mt-8 text-sm text-dust">
          Ver{" "}
          <Link href={`/estilo/${slug}`} className="text-gold hover:underline">
            todos os discos de {nome.toLowerCase()}
          </Link>{" "}
          ou{" "}
          <Link href={`/decada/${start}`} className="text-gold hover:underline">
            todos os vinis dos {anos}
          </Link>
          .
        </p>
        <FacetHubs atual="estilos" className="mt-10" />
      </div>
      <BackToTop />
    </>
  );
}
