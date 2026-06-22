import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import BackToTop from "@/components/BackToTop";
import Pagination from "@/components/Pagination";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getEstiloPageData, getRelatedEstilos, getTopArtistsForEstilo, type SerializedEstiloData, type RelatedEstilo, type TopArtistForEstilo } from "@/lib/db/estilo";
import { getHreflangSlug } from "@/lib/db/hreflang";
import { PEER_ORIGIN } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";

export const revalidate = 86400;

const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

export default async function EstiloPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; precoMax?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { sort = "desconto", precoMax: precoMaxStr, page: pageStr } = await searchParams;
  const precoMax = precoMaxStr !== undefined && precoMaxStr !== "" ? Number(precoMaxStr) : null;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  let data: SerializedEstiloData | null = null;
  let hasPeer = false;
  try {
    [data, hasPeer] = await Promise.all([
      getEstiloPageData(slug, currentPage, sort, precoMax),
      getHreflangSlug("genre", slug).catch(() => false as false),
    ]);
  } catch (err) {
    console.error("[EstiloPage] getEstiloPageData failed for slug=%s", slug);
    if (process.env.NODE_ENV === "development") console.error(err);
    return (
      <main className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-parchment text-lg font-semibold mb-2">
          Erro ao carregar página de estilo
        </p>
        <p className="text-dust text-sm">Tente novamente em alguns instantes.</p>
      </main>
    );
  }
  if (!data) notFound();

  const { canonical, discos, bioShortPt, bioPt, total, totalPages } = data;
  const displayName = canonical.replace(/\b\w/g, (c) => c.toUpperCase());

  const isThin = total <= 3 && !bioShortPt;
  const metaTitle = truncateTitle(`Discos de ${displayName} em Vinil — Ofertas | Garimpa Vinil`);
  const metaDesc = truncateDesc(
    total >= 4
      ? `${total} discos de ${canonical} em vinil com preço monitorado diariamente na Amazon. Ordene por desconto real sobre a média, não promoção inventada.`
      : `Discos de ${canonical} em vinil com preço monitorado diariamente na Amazon. Veja o histórico de 12 meses antes de comprar.`
  );
  const firstImageEstilo = discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  const estiloCanonicalUrl = `${SITE_URL}/estilo/${slug}`;

  let relatedEstilos: RelatedEstilo[] = [];
  let topArtists: TopArtistForEstilo[] = [];
  [relatedEstilos, topArtists] = await Promise.all([
    getRelatedEstilos(canonical).catch((err) => {
      console.error("[EstiloPage] getRelatedEstilos failed for canonical=%s", canonical, err);
      return [] as RelatedEstilo[];
    }),
    getTopArtistsForEstilo(canonical).catch((err) => {
      console.error("[EstiloPage] getTopArtistsForEstilo failed for canonical=%s", canonical, err);
      return [] as TopArtistForEstilo[];
    }),
  ]);

  // Apply staleness check for deal badge display only (DB handles sort).
  const discosProcessados = discos.map((disco) => {
    const crawledAt = disco.lastCrawledAt ? new Date(disco.lastCrawledAt).getTime() : null;
    const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
    const dealScore = disco.dealScore !== null && !dealIsStale ? disco.dealScore : null;
    return {
      ...disco,
      rating: disco.rating ? Number(disco.rating) : null,
      emPromocao: dealScore !== null,
      dealScore,
      disponivel: true,
    };
  });

  const siteUrl = SITE_URL;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início",  item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Estilos", item: `${siteUrl}/estilos` },
      { "@type": "ListItem", position: 3, name: displayName, item: `${siteUrl}/estilo/${slug}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos de ${displayName}`,
    url: `${siteUrl}/estilo/${slug}`,
    numberOfItems: total,
    itemListElement: discos.slice(0, 10).map((disco, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/disco/${disco.slug}`,
      name: disco.titulo,
    })),
  });

  const musicGenreJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "MusicGenre",
    name: displayName,
    url: `${siteUrl}/estilo/${slug}`,
  });

  return (
    <>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDesc} />
      <link rel="canonical" href={estiloCanonicalUrl} />
      {(isThin || currentPage > 1 || sort !== "desconto" || precoMax !== null) && (
        <meta name="robots" content="noindex, follow" />
      )}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:url" content={estiloCanonicalUrl} />
      <meta property="og:image" content={firstImageEstilo ?? `${SITE_URL}/og-default.png`} />
      <meta name="twitter:card" content={firstImageEstilo ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={firstImageEstilo ?? `${SITE_URL}/og-default.png`} />
      {hasPeer && (
        <>
          <link rel="alternate" hrefLang="pt-BR" href={estiloCanonicalUrl} />
          <link rel="alternate" hrefLang="en-US" href={`${PEER_ORIGIN}/genre/${slug}`} />
          <link rel="alternate" hrefLang="x-default" href={`${PEER_ORIGIN}/genre/${slug}`} />
        </>
      )}
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: musicGenreJsonLd }} />
      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/estilos" className="hover:text-cream transition-colors">
          Estilos
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">{displayName}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-cream">
          {displayName}
        </h1>
        <p className="mt-1 text-dust text-sm">
          {formatDiscoCount(total)}
          {precoMax !== null && !isNaN(precoMax)
            ? ` até R$ ${precoMax.toLocaleString("pt-BR")}`
            : ""}
        </p>
      </header>

      {bioShortPt && (
        <div className="mb-5 bg-sleeve border border-groove rounded-xl px-5 py-4">
          <p className="text-parchment text-sm leading-relaxed">{bioShortPt}</p>
        </div>
      )}

      {/* Top artists in this genre — internal link equity to artist pages */}
      {topArtists.length > 0 && (
        <div className="mb-5">
          <p className="text-dust text-xs font-semibold uppercase tracking-widest mb-2">
            Artistas em {displayName}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {topArtists.map((a) => (
              <li key={a.slug}>
                <Link
                  href={`/artista/${a.slug}`}
                  className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
                >
                  {a.artista}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related genres — above the grid for topical graph signals */}
      {relatedEstilos.length > 0 && (
        <div className="mb-5">
          <p className="text-dust text-xs font-semibold uppercase tracking-widest mb-2">
            Estilos relacionados
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {relatedEstilos.map((e) => (
              <li key={e.slug}>
                <Link
                  href={`/estilo/${e.slug}`}
                  className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
                >
                  {e.tag.replace(/\b\w/g, (c) => c.toUpperCase())}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-4">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {discosProcessados.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {discosProcessados.map((disco, index) => (
              <DiscoCard key={disco.id} disco={disco} priority={index < 4} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchParams={{ sort: sort !== "desconto" ? sort : undefined, precoMax: precoMaxStr }}
              basePath={`/estilo/${slug}`}
            />
          )}
        </>
      ) : (
        <div className="text-center py-24 text-dust">
          <div className="inline-block mb-5 opacity-40">
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto">
              <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
              <circle cx="32" cy="32" r="20" className="fill-record" opacity="0.8" />
              <circle cx="32" cy="32" r="5"  className="fill-gold" opacity="0.4" />
              <circle cx="32" cy="32" r="2"  className="fill-record" />
            </svg>
          </div>
          <p className="font-display text-parchment text-lg font-semibold mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-dust text-sm">Tente ajustar os filtros.</p>
        </div>
      )}

      {bioPt && (
        <section className="mt-10 bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-bold text-cream mb-3">Sobre o estilo {displayName}</h2>
          {bioPt.split("\n\n").map((p, i) => (
            <p key={i} className="text-parchment text-sm leading-relaxed mb-3 last:mb-0">{p}</p>
          ))}
        </section>
      )}

      <BackToTop />
    </main>
    </>
  );
}
