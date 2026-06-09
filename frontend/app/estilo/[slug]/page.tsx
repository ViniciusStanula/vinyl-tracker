import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import BackToTop from "@/components/BackToTop";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { formatDiscoCount } from "@/lib/utils/formatters";
import { getEstiloPageData, getRelatedEstilos, type SerializedEstiloData, type RelatedEstilo } from "@/lib/db/estilo";
import { getHreflangSlug } from "@/lib/db/hreflang";
import { PEER_ORIGIN } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/siteUrl";

export const revalidate = 3600; // safety-net; on-demand purge via revalidateTag("prices") fires first

type Sort = "deals" | "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [data, hasPeer] = await Promise.all([
    getEstiloPageData(slug).catch(() => null),
    getHreflangSlug("genre", slug).catch(() => false),
  ]);
  if (!data) return {};
  const { canonical } = data;
  const displayName = canonical.replace(/\b\w/g, (c) => c.toUpperCase());
  const title = truncateTitle(`${displayName} — Discos em Promoção | Garimpa Vinil`);
  const description = truncateDesc(`Melhores ofertas de discos de ${displayName} em vinil: acompanhe o histórico de preços e encontre o disco certo pelo menor valor.`);
  const firstImage = data.discos.find((d) => d.imgUrl)?.imgUrl ?? null;
  return {
    title,
    description,
    alternates: {
      canonical: `/estilo/${slug}`,
      ...(hasPeer ? {
        languages: {
          "pt-BR": `/estilo/${slug}`,
          "en-US": `${PEER_ORIGIN}/genre/${slug}`,
          "x-default": `${PEER_ORIGIN}/genre/${slug}`,
        },
      } : {}),
    },
    openGraph: {
      title,
      description,
      url: `/estilo/${slug}`,
      type: "website",
      images: firstImage ? [{ url: firstImage, alt: displayName }] : ["/og-default.png"],
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      images: [firstImage ?? "/og-default.png"],
    },
  };
}

export default async function EstiloPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sort?: string; precoMax?: string }>;
}) {
  const { slug } = await params;
  const { sort = "desconto", precoMax: precoMaxStr } = await searchParams;
  const precoMax =
    precoMaxStr !== undefined && precoMaxStr !== "" ? Number(precoMaxStr) : null;

  let data: SerializedEstiloData | null = null;
  try {
    data = await getEstiloPageData(slug);
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

  const { canonical, discos, bioShortPt, bioPt } = data;
  const displayName = canonical.replace(/\b\w/g, (c) => c.toUpperCase());

  let relatedEstilos: RelatedEstilo[] = [];
  try {
    relatedEstilos = await getRelatedEstilos(canonical);
  } catch (err) {
    console.error("[EstiloPage] getRelatedEstilos failed for canonical=%s", canonical, err);
  }

  const DEAL_STALE_MS = 4 * 60 * 60 * 1000;

  const discosProcessados = discos.map((disco) => {
    const crawledAt = disco.lastCrawledAt
      ? new Date(disco.lastCrawledAt).getTime()
      : null;
    const dealIsStale =
      crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
    const dealScore =
      disco.dealScore !== null && !dealIsStale ? disco.dealScore : null;

    return {
      ...disco,
      rating: disco.rating ? Number(disco.rating) : null,
      emPromocao: dealScore !== null,
      dealScore,
    };
  });

  const filtrados =
    precoMax !== null && !isNaN(precoMax)
      ? discosProcessados.filter((d) => d.precoAtual <= precoMax)
      : discosProcessados;

  const sorted = [...filtrados].sort((a, b) => {
    switch (sort as Sort) {
      case "deals":
        return (b.dealScore ?? -1) - (a.dealScore ?? -1) || b.desconto - a.desconto;
      case "menor-preco":
        return a.precoAtual - b.precoAtual;
      case "maior-preco":
        return b.precoAtual - a.precoAtual;
      case "avaliados":
        return (b.rating ?? 0) - (a.rating ?? 0);
      case "az":
        return a.titulo.localeCompare(b.titulo, "pt-BR");
      case "desconto":
      default:
        return b.desconto - a.desconto;
    }
  });

  // Cap rendered cards — big styles (rock, pop) would otherwise ship
  // thousands of cards in one HTML payload.
  const GRID_CAP = 60;
  const visiveis = sorted.slice(0, GRID_CAP);

  const siteUrl = SITE_URL;

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: displayName,
        item: `${siteUrl}/estilo/${slug}`,
      },
    ],
  }).replace(/<\//g, "<\\/");

  const itemListJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Discos de ${displayName}`,
    url: `${siteUrl}/estilo/${slug}`,
    numberOfItems: sorted.length,
    itemListElement: sorted.slice(0, 10).map((disco, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${siteUrl}/disco/${disco.slug}`,
      name: disco.titulo,
    })),
  }).replace(/<\//g, "<\\/");

  return (
    <main id="main-content" className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: itemListJsonLd }} />
      <nav className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span>›</span>
        <span className="text-parchment">{displayName}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-cream">
          {displayName}
        </h1>
        <p className="mt-1 text-dust text-sm">
          {formatDiscoCount(sorted.length)}
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

      <div className="mb-4">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {sorted.length > 0 ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {visiveis.map((disco, index) => (
              <DiscoCard key={disco.id} disco={disco} priority={index < 4} />
            ))}
          </div>
          {sorted.length > GRID_CAP && (
            <p className="text-dust text-sm text-center mt-6">
              Exibindo os {GRID_CAP} primeiros de {sorted.length} discos.
              Use os filtros para refinar, ou{" "}
              <Link href="/disco" className="text-parchment hover:text-gold underline underline-offset-2 transition-colors">
                veja o catálogo completo
              </Link>
              .
            </p>
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

      {relatedEstilos.length > 0 && (
        <section className="mt-12 pt-8 border-t border-groove">
          <h2 className="text-dust text-xs font-semibold uppercase tracking-widest mb-3">
            Outros estilos
          </h2>
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
        </section>
      )}

      <BackToTop />
    </main>
  );
}
