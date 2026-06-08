import DiscoCard from "@/components/DiscoCard";
import Pagination from "@/components/Pagination";
import SortBar from "@/components/SortBar";
import BackToTop from "@/components/BackToTop";
import StyleTags from "@/components/StyleTags";
import Link from "next/link";
import { notFound } from "next/navigation";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { toTitleCase } from "@/lib/utils/titleCase";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { Suspense } from "react";
import { getArtistaPageData, type ArtistaPageData } from "@/lib/db/artista";
import { getHreflangSlug } from "@/lib/db/hreflang";
import { PEER_ORIGIN } from "@/lib/hreflang";

export const revalidate = 3600; // safety-net; on-demand purge via revalidateTag("prices") fires first

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, hasPeer] = await Promise.all([
    getArtistaPageData(slug, 1, "desconto", null).catch(() => null),
    getHreflangSlug("artist", slug).catch(() => false),
  ]);
  if (!data) return {};
  const { canonical } = data;
  const displayName = toTitleCase(canonical);
  const title = truncateTitle(`${displayName} — Discos em Promoção | Garimpa Vinil`);
  const description = truncateDesc(`Melhores ofertas de ${displayName} em vinil: acompanhe o histórico de preços e encontre o disco certo pelo menor valor.`);
  const firstImage = data.items.find((d) => d.imgUrl)?.imgUrl ?? null;
  return {
    title,
    description,
    alternates: {
      canonical: `/artista/${slug}`,
      ...(hasPeer ? {
        languages: {
          "pt-BR": `/artista/${slug}`,
          "en-US": `${PEER_ORIGIN}/artist/${slug}`,
          "x-default": `${PEER_ORIGIN}/artist/${slug}`,
        },
      } : {}),
    },
    openGraph: {
      title,
      description,
      url: `/artista/${slug}`,
      type: "website",
      ...(firstImage ? { images: [{ url: firstImage, alt: displayName }] } : {}),
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(firstImage ? { images: [firstImage] } : {}),
    },
  };
}

export default async function ArtistaPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; precoMax?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { sort = "desconto", precoMax: precoMaxStr, page: pageStr } = await searchParams;
  const precoMax =
    precoMaxStr !== undefined && precoMaxStr !== "" ? Number(precoMaxStr) : null;
  const currentPage = Math.max(1, parseInt(pageStr ?? "1", 10) || 1);

  let data: ArtistaPageData | null = null;
  try {
    data = await getArtistaPageData(slug, currentPage, sort, precoMax);
  } catch (err) {
    console.error("[ArtistaPage] getArtistaPageData failed for slug=%s", slug);
    if (process.env.NODE_ENV === "development") console.error(err);
    return (
      <main id="main-content" className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-parchment text-lg font-semibold mb-2">
          Erro ao carregar página do artista
        </p>
        <p className="text-dust text-sm">Tente novamente em alguns instantes.</p>
      </main>
    );
  }
  if (!data) notFound();

  const { canonical, items, total, totalPages, topStyles, sameAs, bioShortPt, bioPt } = data;
  const artista = toTitleCase(canonical);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: artista,
        item: `${siteUrl}/artista/${slug}`,
      },
    ],
  }).replace(/<\//g, "<\\/");

  const itemListJsonLd = JSON.stringify({
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
  }).replace(/<\//g, "<\\/");

  const musicArtistJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: artista,
    url: `${siteUrl}/artista/${slug}`,
    ...(topStyles.length > 0 ? { genre: topStyles } : {}),
    ...(sameAs.length > 0 ? { sameAs } : {}),
  }).replace(/<\//g, "<\\/");

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
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
        <span className="text-parchment">{artista}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-black text-cream [text-wrap:balance]">
          {artista}
        </h1>
        <p className="mt-1 text-dust text-sm">
          {formatDiscoCount(total)}
          {precoMax !== null && !isNaN(precoMax)
            ? ` até R$ ${precoMax.toLocaleString("pt-BR")}`
            : ""}
        </p>
        <StyleTags tags={topStyles} />
      </header>

      {bioShortPt && (
        <div className="mb-5 bg-sleeve border border-groove rounded-xl px-5 py-4">
          <p className="text-parchment text-sm leading-relaxed">{bioShortPt}</p>
        </div>
      )}

      <div className="sticky top-[62px] z-40 mb-3 bg-record/95 backdrop-blur-md -mx-4 px-4 pt-2 pb-2">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map((disco, index) => (
              <DiscoCard key={disco.id} disco={disco} priority={index < 4} />
            ))}
          </div>
          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              searchParams={{ sort: sort !== "desconto" ? sort : undefined, precoMax: precoMaxStr }}
              basePath={`/artista/${slug}`}
            />
          )}
        </>
      ) : (
        <section aria-label="Sem resultados" className="text-center py-24 text-dust">
          <div className="inline-block mb-5 opacity-40">
            <svg viewBox="0 0 64 64" fill="none" className="w-16 h-16 mx-auto" aria-hidden="true">
              <circle cx="32" cy="32" r="30" className="fill-gold" opacity="0.3" />
              <circle cx="32" cy="32" r="20" className="fill-record" opacity="0.8" />
              <circle cx="32" cy="32" r="5"  className="fill-gold" opacity="0.4" />
              <circle cx="32" cy="32" r="2"  className="fill-record" />
            </svg>
          </div>
          <p className="font-display text-parchment text-lg font-semibold mb-2">
            Nenhum disco encontrado
          </p>
          <p className="text-dust text-sm mb-4">Tente ajustar os filtros.</p>
          {(precoMax !== null || sort !== "desconto") && (
            <Link
              href={`/artista/${slug}`}
              className="inline-flex items-center gap-2 bg-groove hover:bg-wax text-parchment text-sm px-5 py-2 rounded-full transition-colors border border-wax/60"
            >
              Limpar filtros
            </Link>
          )}
        </section>
      )}

      {bioPt && (
        <section className="mt-10 bg-sleeve border border-groove rounded-xl p-6">
          <h2 className="font-display text-xl font-black text-cream mb-3">Sobre {artista}</h2>
          {bioPt.split("\n\n").map((p, i) => (
            <p key={i} className="text-parchment text-sm leading-relaxed mb-3 last:mb-0">{p}</p>
          ))}
        </section>
      )}

      <BackToTop />
    </main>
  );
}
