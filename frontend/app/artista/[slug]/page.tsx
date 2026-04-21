import { prisma } from "@/lib/prisma";
import DiscoCard from "@/components/DiscoCard";
import SortBar from "@/components/SortBar";
import BackToTop from "@/components/BackToTop";
import StyleTags from "@/components/StyleTags";
import Link from "next/link";
import { notFound } from "next/navigation";
import { slugifyArtist } from "@/lib/slugify";
import { truncateTitle, truncateDesc } from "@/lib/seo";
import { getTopStyles } from "@/lib/styleUtils";
import { Suspense, cache } from "react";
import { unstable_cache } from "next/cache";

// Covers the full set of accented characters produced by slugifyArtist()'s
// NFD normalization for Portuguese, Spanish, French, German, and other common
// artist name origins. translate() is a built-in PostgreSQL function that
// requires no extension, unlike unaccent().
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiioooouuuucny";

type Sort = "desconto" | "menor-preco" | "maior-preco" | "avaliados" | "az";

type SerializedPageData = {
  canonical: string;
  discos: {
    id: string;
    asin: string;
    titulo: string;
    artista: string;
    slug: string;
    estilo: string | null;
    lastfmTags: string | null;
    imgUrl: string | null;
    url: string;
    rating: string | null;
    reviewCount: number | null;
    precos: { precoBrl: string; capturadoEm: number }[];
  }[];
  dealMeta: Record<string, {
    id: string;
    deal_score: number | null;
    confidence_level: string | null;
    last_crawled_at: string | null;
    disponivel: boolean;
  }>;
};

/**
 * Fetches and serializes all data needed to render an artist page.
 * Returns JSON-safe values so the result survives unstable_cache serialization.
 * Dates are stored as millisecond timestamps (numbers) or ISO strings.
 * Wrapped with React cache() so generateMetadata and the page share one result per request.
 */
const _getArtistaPageData = unstable_cache(
  async (slug: string): Promise<SerializedPageData | null> => {
    // Pre-filter at the DB level using a SQL slug approximation so we transfer
    // only candidates instead of the full artist table. Two expressions cover:
    //   1. Regular names: lower(regexp_replace(artista, '[^a-z0-9]+', '-', 'g'))
    //   2. Inverted "LAST,FIRST" names: swap parts before slugifying
    // The JS slugifyArtist() filter below is the exact match safety-net for
    // edge cases (accent stripping via NFD that SQL doesn't reproduce exactly).
    const candidates = await prisma.$queryRaw<{ artista: string }[]>`
      SELECT DISTINCT artista FROM "Disco"
      WHERE left(
              regexp_replace(
                regexp_replace(translate(lower(artista), ${ACCENT_FROM}, ${ACCENT_TO}), '[^a-z0-9]+', '-', 'g'),
                '^-+|-+$', '', 'g'
              ), 60) = ${slug}
         OR left(
              regexp_replace(
                regexp_replace(
                  translate(
                    lower(trim(split_part(artista, ',', 2)) || ' ' || trim(split_part(artista, ',', 1))),
                    ${ACCENT_FROM}, ${ACCENT_TO}
                  ),
                  '[^a-z0-9]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
              ), 60) = ${slug}
    `;

    const variants = candidates
      .map((r) => r.artista)
      .filter((a) => slugifyArtist(a) === slug);

    if (variants.length === 0) return null;

    // Pick the cleanest name: prefer no comma, then shortest (usually proper-cased)
    const canonical = variants.slice().sort((a, b) => {
      const aScore = (a.includes(",") ? 1 : 0) + (a === a.toUpperCase() ? 1 : 0);
      const bScore = (b.includes(",") ? 1 : 0) + (b === b.toUpperCase() ? 1 : 0);
      return aScore - bScore || a.length - b.length;
    })[0];

    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const discos = await prisma.disco.findMany({
      where: { artista: { in: variants } },
      include: {
        precos: {
          where: { capturadoEm: { gte: oneYearAgo } },
          orderBy: { capturadoEm: "desc" },
          take: 60,
        },
      },
    });

    if (discos.length === 0) return null;

    const discoIds = discos.map((d) => d.id);

    const [dealMetaRows, lastfmTagsRows] = await Promise.all([
      prisma.$queryRaw<{
        id: string;
        deal_score: number | null;
        confidence_level: string | null;
        last_crawled_at: Date | null;
        disponivel: boolean;
      }[]>`
        SELECT id::text, deal_score, confidence_level, last_crawled_at, disponivel
        FROM "Disco"
        WHERE id::text = ANY(${discoIds})
      `,
      prisma.$queryRaw<{ id: string; lastfmTags: string | null }[]>`
        SELECT id::text, lastfm_tags AS "lastfmTags"
        FROM "Disco"
        WHERE id::text = ANY(${discoIds})
      `,
    ]);
    const lastfmTagsById = Object.fromEntries(
      lastfmTagsRows.map((r) => [r.id, r.lastfmTags])
    );

    return {
      canonical,
      discos: discos.map((d) => ({
        id: d.id,
        asin: d.asin,
        titulo: d.titulo,
        artista: d.artista,
        slug: d.slug,
        estilo: d.estilo,
        lastfmTags: lastfmTagsById[d.id] ?? null,
        imgUrl: d.imgUrl,
        url: d.url,
        rating: d.rating ? String(d.rating) : null,
        reviewCount: d.reviewCount,
        precos: d.precos.map((p) => ({
          precoBrl: String(p.precoBrl),
          capturadoEm: p.capturadoEm.getTime(),
        })),
      })),
      dealMeta: Object.fromEntries(
        dealMetaRows.map((r) => [r.id, {
          id: r.id,
          deal_score: r.deal_score !== null ? Number(r.deal_score) : null,
          confidence_level: r.confidence_level,
          last_crawled_at: r.last_crawled_at ? new Date(r.last_crawled_at).toISOString() : null,
          disponivel: r.disponivel,
        }])
      ),
    };
  },
  ["artista-page"],
  { tags: ["prices"] }
);

const getArtistaPageData = cache(_getArtistaPageData);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getArtistaPageData(slug);
  if (!data) return {};
  const { canonical } = data;
  const title = truncateTitle(`${canonical} — Discos em Promoção | Garimpa Vinil`);
  const description = truncateDesc(`Melhores ofertas de ${canonical} em vinil: acompanhe o histórico de preços e encontre o disco certo pelo menor valor.`);
  return {
    title,
    description,
    alternates: { canonical: `/artista/${slug}` },
    openGraph: {
      title,
      description,
      url: `/artista/${slug}`,
      type: "website",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function ArtistaPage({
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

  let data: SerializedPageData | null = null;
  try {
    data = await getArtistaPageData(slug);
  } catch (err) {
    console.error("[ArtistaPage] getArtistaPageData failed for slug=%s", slug);
    if (process.env.NODE_ENV === "development") console.error(err);
    return (
      <main className="max-w-7xl mx-auto px-4 py-24 text-center">
        <p className="font-display text-parchment text-lg font-semibold mb-2">
          Erro ao carregar página do artista
        </p>
        <p className="text-dust text-sm">Tente novamente em alguns instantes.</p>
      </main>
    );
  }
  if (!data) notFound();

  const { canonical: artista, discos, dealMeta } = data;
  const topStyles = getTopStyles(discos.map((d) => d.lastfmTags), 5, artista);

  // Filter out unavailable products from the artist page listing
  const discosDisponiveis = discos.filter((d) => dealMeta[d.id]?.disponivel !== false);

  const thirtyDaysAgoMs = Date.now() - 30 * 24 * 60 * 60 * 1000;

  const discosProcessados = discosDisponiveis.map((disco) => {
    const precos = disco.precos.map((p) => Number(p.precoBrl));
    const precoAtual = precos[0] ?? 0;
    const media =
      precos.length > 0
        ? precos.reduce((a, b) => a + b, 0) / precos.length
        : precoAtual;
    const desconto = media > 0 ? (media - precoAtual) / media : 0;

    // Build sparkline from last 10 price points within the 30-day window.
    // capturadoEm is stored as a millisecond timestamp in the serialized cache.
    const sparkline = [...disco.precos]
      .filter((p) => p.capturadoEm >= thirtyDaysAgoMs)
      .sort((a, b) => a.capturadoEm - b.capturadoEm)
      .slice(-10)
      .map((p) => Number(p.precoBrl));

    const meta = dealMeta[disco.id];
    const rawDealScore = meta?.deal_score !== null && meta?.deal_score !== undefined
      ? Number(meta.deal_score)
      : null;

    const DEAL_STALE_MS = 4 * 60 * 60 * 1000;
    const crawledAt = meta?.last_crawled_at ? new Date(meta.last_crawled_at).getTime() : null;
    const dealIsStale = crawledAt === null || Date.now() - crawledAt > DEAL_STALE_MS;
    const dealScore = rawDealScore !== null && !dealIsStale ? rawDealScore : null;

    return {
      ...disco,
      rating:          disco.rating ? Number(disco.rating) : null,
      precoAtual,
      mediaPreco:      media,
      // emPromocao mirrors the scorer: a product is on promotion iff deal_score is set
      emPromocao:      dealScore !== null,
      desconto,
      sparkline,
      dealScore,
      confidenceLevel: meta?.confidence_level ?? null,
    };
  });

  // Apply price filter
  const filtrados =
    precoMax !== null && !isNaN(precoMax)
      ? discosProcessados.filter((d) => d.precoAtual <= precoMax)
      : discosProcessados;

  // Apply sort
  const sorted = [...filtrados].sort((a, b) => {
    switch (sort as Sort) {
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
  });

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      <nav className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span>›</span>
        <span className="text-parchment">{artista}</span>
      </nav>

      <header className="mb-6">
        <h1 className="font-display text-3xl font-bold text-cream">
          {artista}
        </h1>
        <p className="mt-1 text-dust text-sm">
          {sorted.length}{" "}
          {sorted.length === 1 ? "disco" : "discos"}
          {precoMax !== null && !isNaN(precoMax)
            ? ` até R$ ${precoMax.toLocaleString("pt-BR")}`
            : " rastreados"}
        </p>
        <StyleTags tags={topStyles} />
      </header>

      <div className="mb-4">
        <Suspense>
          <SortBar />
        </Suspense>
      </div>

      {sorted.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {sorted.map((disco, index) => (
            <DiscoCard key={disco.id} disco={disco} priority={index < 4} />
          ))}
        </div>
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

      <BackToTop />
    </main>
  );
}
