import GuiasRelacionados from "@/components/GuiasRelacionados";
import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getEstiloPageData, getRelatedEstilos, getTopArtistsForEstilo, getEstiloDisplayName, REDIRECTED_ESTILO_SLUGS, type SerializedEstiloData, type RelatedEstilo, type TopArtistForEstilo } from "@/lib/db/estilo";
import { getTopBotHitSlugs } from "@/lib/db/disco";
import { getHreflangSlug } from "@/lib/db/hreflang";
import { PEER_ORIGIN } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// Prebuilds the styles bots hit most (bot_hits-ranked); the rest still
// render + CDN-cache on first request as before. dynamicParams stays true
// (default). Sort/filter/pagination run client-side (ArtistaRecords) so no
// server searchParams force the route dynamic either way.
export async function generateStaticParams() {
  return (await getTopBotHitSlugs("/estilo/", 500)).map((slug) => ({ slug }));
}

// Top-N cap: fetch the style's best records (default desconto sort) in one shot
// so client-side sort/filter is instant. Big genres (rock ~5k) get truncated,
// but deep pagination was already noindexed (page > 1) and near-zero traffic.
const RECORDS_CAP = 240;

const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

// Filter-independent metadata: canonical is always the clean URL, so any
// ?-variant a user shares consolidates to it. Reading no searchParams here is
// part of what keeps the route static.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (REDIRECTED_ESTILO_SLUGS.has(slug)) return { title: "Estilo | Garimpa Vinil", robots: { index: false, follow: false } };

  const [data, hasPeer] = await Promise.all([
    getEstiloPageData(slug, 1, "desconto", null, RECORDS_CAP).catch(() => null),
    getHreflangSlug("genre", slug).catch(() => false as false),
  ]);

  if (!data) return { title: "Estilo | Garimpa Vinil" };

  const { canonical, discos, total, bioShortPt } = data;
  const displayName = getEstiloDisplayName(canonical);
  const displayNameLower = displayName.toLowerCase();
  const noindex = total <= 3 && !bioShortPt;

  const title = truncateTitle(`Discos de ${displayName} em Vinil — Ofertas | Garimpa Vinil`);
  const description = truncateDesc(
    total >= 4
      ? `${total} discos de ${displayNameLower} em vinil com preço monitorado diariamente na Amazon. Ordene por desconto real sobre a média, não promoção inventada.`
      : `Discos de ${displayNameLower} em vinil com preço monitorado diariamente na Amazon. Veja o histórico de 12 meses antes de comprar.`
  );
  const firstImage = discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  const canonicalUrl = `${SITE_URL}/estilo/${slug}`;

  return {
    title,
    description,
    robots: noindex ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: canonicalUrl,
      ...(hasPeer && !noindex
        ? {
            languages: {
              "pt-BR": `${SITE_URL}/estilo/${slug}`,
              "en-US": `${PEER_ORIGIN}/genre/${slug}`,
              "x-default": `${PEER_ORIGIN}/genre/${slug}`,
            },
          }
        : {}),
    },
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

export default async function EstiloPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (REDIRECTED_ESTILO_SLUGS.has(slug)) notFound();

  // Top records, default sort, no filter → static/cacheable; ArtistaRecords
  // does sort/filter/pagination in the browser.
  let data: SerializedEstiloData | null = null;
  try {
    data = await getEstiloPageData(slug, 1, "desconto", null, RECORDS_CAP);
  } catch (err) {
    console.error("[EstiloPage] getEstiloPageData failed for slug=%s", slug);
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

  const { canonical, discos, bioShortPt, bioPt, total } = data;
  const displayName = getEstiloDisplayName(canonical);

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

  // Apply staleness check for deal badge display + shape rows as ProcessedDisco
  // for the client component (fields the estilo query doesn't fetch stay null).
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
      <div className="max-w-7xl mx-auto px-4 py-8">
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
        <p className="mt-1 text-dust text-sm">{formatDiscoCount(total)}</p>
      </header>

      {bioShortPt && (
        <div className="mb-5 bg-sleeve border border-groove rounded-xl px-5 py-4">
          <p className="text-parchment text-sm leading-relaxed line-clamp-3 sm:line-clamp-none">{bioShortPt}</p>
        </div>
      )}

      {discosProcessados.length > 0 ? (
        <section aria-labelledby="discos-estilo-heading">
          <h2 id="discos-estilo-heading" className="sr-only">Discos de {displayName} em vinil</h2>
          <ArtistaRecords items={discosProcessados} slug={slug} basePath="/estilo" />
        </section>
      ) : (
        <section aria-label="Sem resultados" className="text-center py-24 text-dust">
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
        </section>
      )}

      {/* Top artists in this genre — internal link equity to artist pages.
          Kept below the grid so the product list leads on mobile. */}
      {topArtists.length > 0 && (
        <nav aria-labelledby="artistas-genero-heading" className="mt-8">
          <p id="artistas-genero-heading" className="text-dust text-xs font-semibold uppercase tracking-widest mb-2">
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
        </nav>
      )}

      {/* Related genres — topical graph signals */}
      {relatedEstilos.length > 0 && (
        <nav aria-labelledby="estilos-relacionados-heading" className="mt-5">
          <p id="estilos-relacionados-heading" className="text-dust text-xs font-semibold uppercase tracking-widest mb-2">
            Estilos relacionados
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {relatedEstilos.map((e) => (
              <li key={e.slug}>
                <Link
                  href={`/estilo/${e.slug}`}
                  className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-dust hover:text-parchment hover:border-wax/70 transition-colors"
                >
                  {getEstiloDisplayName(e.tag)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <GuiasRelacionados className="mt-8" />

      {bioPt && (
        <section aria-labelledby="sobre-estilo-heading" className="mt-10 bg-sleeve border border-groove rounded-xl p-6">
          <h2 id="sobre-estilo-heading" className="font-display text-xl font-bold text-cream mb-3">Sobre o estilo {displayName}</h2>
          {bioPt.split("\n\n").map((p, i) => (
            <p key={i} className="text-parchment text-sm leading-relaxed mb-3 last:mb-0">{p}</p>
          ))}
        </section>
      )}

      <BackToTop />
    </div>
    </>
  );
}
