import GuiasRelacionados from "@/components/GuiasRelacionados";
import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import FacetHubs from "@/components/FacetHubs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getEstiloPageData, getRelatedEstilos, getTopArtistsForEstilo, getEstiloDisplayName, REDIRECTED_ESTILO_SLUGS, type SerializedEstiloData, type RelatedEstilo, type TopArtistForEstilo } from "@/lib/db/estilo";
import { getTopBotHitSlugs } from "@/lib/db/disco";
import { getDecadasForEstilo } from "@/lib/db/estiloDecada";
import { decadaLabel } from "@/lib/decadas";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd, discoListItems } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// Prebuilds the styles bots hit most (bot_hits-ranked); the rest still
// render + CDN-cache on first request as before. dynamicParams stays true
// (default). Sort/filter/pagination run client-side (ArtistaRecords) so no
// server searchParams force the route dynamic either way.
export async function generateStaticParams() {
  return (await getTopBotHitSlugs("/estilo/", 50)).map((slug) => ({ slug }));
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

  const data = await getEstiloPageData(slug, 1, "desconto", null, RECORDS_CAP).catch(() => null);

  if (!data) return { title: "Estilo | Garimpa Vinil" };

  const { canonical, discos, total, bioShortPt } = data;
  const displayName = getEstiloDisplayName(canonical);
  const displayNameLower = displayName.toLowerCase();
  const noindex = total <= 3 && !bioShortPt;

  const title = truncateTitle(`Discos de ${displayName} em Vinil — Ofertas | Garimpa Vinil`);
  const description = truncateDesc(
    total >= 4
      ? `${total.toLocaleString("pt-BR")} discos de ${displayNameLower} em vinil na Amazon, com preço acompanhado todo dia. Ordene pelo desconto real sobre a média de 30 dias.`
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
    // Re-thrown, not rendered as a friendly 200: a soft error page is a
    // successful response, so ISR cached it and one transient failure left the
    // route serving a headingless stub until revalidation. app/error.tsx shows
    // the same message on an uncached 500 instead.
    throw err;
  }
  if (!data) notFound();

  const { canonical, discos, bioShortPt, bioPt, total } = data;
  const displayName = getEstiloDisplayName(canonical);

  const decadas = await getDecadasForEstilo(slug).catch(() => []);

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

  // Apply staleness check for deal badge display.
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
    itemListElement: discoListItems(discos, siteUrl),
  });

  const musicGenreJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "MusicGenre",
    // @id so the per-decade pages under this style can reference the same
    // genre rather than declaring an unrelated one of their own.
    "@id": `${siteUrl}/estilo/${slug}#genre`,
    name: displayName,
    url: `${siteUrl}/estilo/${slug}`,
    // The style blurb the page already renders above the grid.
    ...(bioShortPt ? { description: bioShortPt } : {}),
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

      {/* Decade cuts of this genre. Only decades with enough records to carry a
          page of their own appear, so this never links to a noindexed cell. */}
      {decadas.length > 1 && (
        <nav aria-labelledby="decadas-estilo-heading" className="mt-8">
          <p id="decadas-estilo-heading" className="text-dust text-xs font-semibold uppercase tracking-widest mb-2">
            {displayName} por década
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {decadas.map((c) => (
              <li key={c.decada}>
                <Link
                  href={`/estilo/${slug}/${c.decada}`}
                  className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-parchment hover:text-cream hover:border-wax/70 transition-colors"
                >
                  {decadaLabel(c.decada)} ({c.discoCount})
                </Link>
              </li>
            ))}
          </ul>
        </nav>
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
                  className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-parchment hover:text-cream hover:border-wax/70 transition-colors"
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
                  className="inline-flex items-center text-xs px-2.5 py-0.5 rounded-full bg-groove border border-wax/40 text-parchment hover:text-cream hover:border-wax/70 transition-colors"
                >
                  {getEstiloDisplayName(e.tag)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <FacetHubs atual="estilos" className="mt-10" />

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
