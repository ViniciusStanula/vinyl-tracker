import DiscoCard from "@/components/DiscoCard";
import ArtistaRecords from "@/components/ArtistaRecords";
import BackToTop from "@/components/BackToTop";
import StyleTags from "@/components/StyleTags";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { toTitleCase } from "@/lib/utils/titleCase";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getArtistaPageData } from "@/lib/db/artista";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

export const revalidate = 14400; // safety-net; on-demand purge via revalidateTag("prices") fires first

// Without this Next 16 renders the route dynamically (Cache-Control: no-store).
// [] = nothing prebuilt; each artist is rendered + CDN-cached on first request.
// Sort/filter/pagination run client-side (ArtistaRecords) so no server
// searchParams force the route dynamic. dynamicParams stays true (default).
export function generateStaticParams() {
  return [];
}

// Catalog cap: fetch the artist's whole set so client-side filtering is correct.
// Covers every real artist (max non-"unknown" is well under this); the
// "Artista não identificado" bucket is noindex, so truncation there is fine.
const RECORDS_CAP = 200;

// Filter-independent metadata: canonical is always the clean URL, so any
// ?-variant a user shares consolidates to it. Reading no searchParams here is
// part of what keeps the route static.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  const data = await getArtistaPageData(slug, 1, "desconto", null, RECORDS_CAP).catch(() => null);

  if (!data) return { title: "Artista | Garimpa Vinil" };

  const { canonical, items, total, bioShortPt, unavailableItems } = data;
  const artista = toTitleCase(canonical);
  const isUnknownArtist = canonical.toLowerCase() === "artista não identificado";
  const isThin = total <= 2 && !bioShortPt;
  const noindex = isUnknownArtist || isThin;

  const discoLabel = total === 1 ? "1 disco" : `${total} discos`;
  const title = isUnknownArtist
    ? "Discos de Vinil — Vários Artistas | Garimpa Vinil"
    : truncateTitle(`${artista} em Vinil (${discoLabel}) — Histórico de Preço | Garimpa Vinil`);
  const description = isUnknownArtist
    ? truncateDesc("Discos de vinil de vários artistas na Amazon, cada um com histórico de preço de 12 meses. Compare o preço de hoje com a média antes de fechar.")
    : truncateDesc(
        total === 1
          ? `Vinil de ${artista} na Amazon Brasil com histórico de preço de 12 meses. Veja se está com desconto hoje antes de comprar.`
          : `${total} vinis de ${artista} na Amazon Brasil, cada um com histórico de preço de 12 meses. Veja qual está com desconto hoje antes de comprar.`
      );
  const firstImage = items.find((d) => d.imgUrl)?.imgUrl ?? unavailableItems.find((d) => d.imgUrl)?.imgUrl ?? null;
  const canonicalUrl = `${SITE_URL}/artista/${slug}`;

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

export default async function ArtistaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Whole catalog, default sort, no filter → static/cacheable; ArtistaRecords
  // does sort/filter/pagination in the browser.
  const data = await getArtistaPageData(slug, 1, "desconto", null, RECORDS_CAP);
  if (!data) notFound();

  const { canonical, items, total, topStyles, sameAs, bioShortPt, bioPt, unavailableItems } = data;
  const artista = toTitleCase(canonical);
  const isUnknownArtist = canonical.toLowerCase() === "artista não identificado";
  const siteUrl = SITE_URL;

  const breadcrumbJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início",   item: `${siteUrl}/` },
      { "@type": "ListItem", position: 2, name: "Artistas", item: `${siteUrl}/artistas` },
      { "@type": "ListItem", position: 3, name: artista,    item: `${siteUrl}/artista/${slug}` },
    ],
  });

  const itemListJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos de ${artista}`,
    url: `${siteUrl}/artista/${slug}`,
    numberOfItems: total,
    itemListElement: items.slice(0, 10).map((disco, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/disco/${disco.slug}`,
      name: disco.titulo,
    })),
  });

  const musicArtistJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    "@id": `${siteUrl}/artista/${slug}#musicgroup`,
    name: artista,
    url: `${siteUrl}/artista/${slug}`,
    ...(topStyles.length > 0 ? { genre: topStyles } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  });

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: musicArtistJsonLd }} />
      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span aria-hidden="true">›</span>
        <Link href="/artistas" className="hover:text-cream transition-colors">
          Artistas
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment">{artista}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          {artista}
        </h1>
        <p className="mt-1 text-dust text-sm">{formatDiscoCount(total)}</p>
        <StyleTags tags={topStyles} />
      </header>

      {bioShortPt ? (
        <div className="mb-5 bg-sleeve border border-groove rounded-xl px-5 py-4">
          <p className="text-parchment text-sm leading-relaxed line-clamp-3 sm:line-clamp-none">{bioShortPt}</p>
        </div>
      ) : !isUnknownArtist && total > 0 ? (
        <p className="mb-5 text-dust text-sm">
          {total === 1
            ? `1 disco de ${artista} disponível em vinil na Amazon Brasil com histórico de preços.`
            : `${total} discos de ${artista} disponíveis em vinil na Amazon Brasil, cada um com histórico de preços de 12 meses.`}
        </p>
      ) : null}

      {items.length > 0 ? (
        <section aria-labelledby="discos-artista-heading">
          <h2 id="discos-artista-heading" className="sr-only">Discos de {artista} disponíveis</h2>
          <ArtistaRecords items={items} slug={slug} />
        </section>
      ) : (
        <p className="text-dust text-sm py-12 text-center">Nenhum disco disponível no momento.</p>
      )}

      {unavailableItems.length > 0 && (
        <section aria-labelledby="indisponiveis-heading" className="mt-10">
          <h2 id="indisponiveis-heading" className="font-display text-lg font-bold text-dust mb-3">
            Indisponível no momento
          </h2>
          <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {unavailableItems.map((disco) => (
              <li key={disco.id}>
                <DiscoCard disco={disco} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {bioPt && (
        <section aria-labelledby="sobre-artista-heading" className="mt-10 bg-sleeve border border-groove rounded-xl p-6">
          <h2 id="sobre-artista-heading" className="font-display text-xl font-black text-cream mb-3">Sobre {artista}</h2>
          {bioPt.split("\n\n").map((p, i) => (
            <p key={i} className="text-parchment text-sm leading-relaxed mb-3 last:mb-0">{p}</p>
          ))}
        </section>
      )}

      {!isUnknownArtist && total > 0 && (
        <nav aria-label="Guias relacionados" className="mt-10 pt-6 border-t border-groove flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/guias/como-cuidar-de-discos-de-vinil" className="text-dust hover:text-gold transition-colors">
            Como cuidar dos seus discos de vinil
          </Link>
          <Link href="/guias/vinil-180g-vale-a-pena" className="text-dust hover:text-gold transition-colors">
            Vinil 180g vale a pena?
          </Link>
        </nav>
      )}

      <BackToTop />
    </div>
    </>
  );
}
