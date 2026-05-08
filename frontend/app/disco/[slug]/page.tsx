import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import GraficoPreco from "@/components/GraficoPreco";
import DiscoCard from "@/components/DiscoCard";
import BackToTop from "@/components/BackToTop";
import StyleTags from "@/components/StyleTags";
import PriceHistoryTable from "@/components/PriceHistoryTable";
import CopyLinkButton from "@/components/CopyLinkButton";
import TabNav from "@/components/TabNav";
import WikiExpander from "@/components/WikiExpander";
import { slugifyArtist } from "@/lib/slugify";
import { parseStyleTags } from "@/lib/styleUtils";
import { truncateTitle, truncateDesc } from "@/lib/seo";

export const revalidate = 7200;

// Shared between generateMetadata and DiscoPage so both callers within the same
// render pass hit the DB only once (React cache() deduplicates by argument).
const getDiscoWithPrecos = cache(async (slug: string) => {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  return prisma.disco.findUnique({
    where: { slug },
    include: {
      precos: {
        where: { capturadoEm: { gte: oneYearAgo } },
        orderBy: { capturadoEm: "asc" },
      },
    },
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  try {
    const disco = await getDiscoWithPrecos(slug);
    if (!disco) return {};
    const title = truncateTitle(`${disco.titulo} — ${disco.artista} em Vinil | Histórico de Preços`);
    const description = truncateDesc(`Compre ${disco.titulo} de ${disco.artista} pelo melhor preço. Veja o histórico de preços e as melhores ofertas disponíveis agora.`);
    return {
      title,
      description,
      alternates: { canonical: `/disco/${slug}` },
      openGraph: {
        title,
        description,
        url: `/disco/${slug}`,
        type: "music.album",
        ...(disco.imgUrl ? { images: [{ url: disco.imgUrl, alt: `${disco.titulo} por ${disco.artista} — capa do álbum` }] } : {}),
      },
      twitter: {
        card: disco.imgUrl ? "summary_large_image" : "summary",
        title,
        description,
        ...(disco.imgUrl ? { images: [disco.imgUrl] } : {}),
      },
    };
  } catch {
    return {};
  }
}

type RelatedDeal = {
  id: string;
  titulo: string;
  artista: string;
  slug: string;
  imgUrl: string | null;
  url: string;
  estilo: string | null;
  rating: string | null;
  precoAtual: number;
  mediaPreco: number;
  desconto: number;
  sparkline: unknown;
  dealScore: number | null;
  confidenceLevel: string | null;
};

const getRelatedDeals = unstable_cache(
  async (discoId: string): Promise<RelatedDeal[]> => {
    return prisma.$queryRaw<RelatedDeal[]>`
      WITH candidates AS (
        SELECT id, titulo, artista, slug, "imgUrl", url, estilo, rating,
               deal_score, confidence_level, avg_30d
        FROM "Disco"
        WHERE id != ${discoId}
          AND deal_score IS NOT NULL
          AND disponivel = TRUE
          AND price_count >= 5
        ORDER BY deal_score DESC, RANDOM()
        LIMIT 4
      ),
      latest AS (
        SELECT DISTINCT ON ("discoId")
          "discoId", "precoBrl"::float AS preco
        FROM "HistoricoPreco"
        WHERE "discoId" IN (SELECT id FROM candidates)
        ORDER BY "discoId", "capturadoEm" DESC
      )
      SELECT
        c.id,
        c.titulo,
        c.artista,
        c.slug,
        c."imgUrl",
        c.url,
        c.estilo,
        c.rating,
        c.deal_score                                         AS "dealScore",
        c.confidence_level                                   AS "confidenceLevel",
        l.preco                                              AS "precoAtual",
        COALESCE(c.avg_30d::float, l.preco)                  AS "mediaPreco",
        CASE
          WHEN COALESCE(c.avg_30d::float, 0) > 0
          THEN (COALESCE(c.avg_30d::float, l.preco) - l.preco) / COALESCE(c.avg_30d::float, l.preco)
          ELSE 0
        END                                                  AS desconto,
        (
          SELECT COALESCE(
            json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
            '[]'::json
          )
          FROM (
            SELECT "precoBrl", "capturadoEm"
            FROM   "HistoricoPreco"
            WHERE  "discoId" = c.id
              AND  "capturadoEm" >= NOW() - INTERVAL '30 days'
            ORDER  BY "capturadoEm" ASC
            LIMIT  10
          ) sp
        ) AS sparkline
      FROM candidates c
      INNER JOIN latest l ON l."discoId" = c.id
    `;
  },
  ["disco-related-deals"],
  { tags: ["prices"], revalidate: 1800 }
);

export default async function DiscoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // getDiscoWithPrecos is React-cached — generateMetadata's prior call is free.
  const disco = await getDiscoWithPrecos(slug);
  if (!disco) notFound();

  // Fetch metadata and related deals in parallel.
  // lastfm_* columns are crawler-enriched and read directly from DB — no runtime API calls.
  const [metaRow, relatedDeals] = await Promise.all([
    prisma.$queryRaw<[{
      disponivel: boolean;
      lastfmTags: string | null;
      lastfmListeners: number | null;
      lastfmPlaycount: number | null;
      lastfmWikiPt: string | null;
    }]>`
      SELECT
        disponivel,
        lastfm_tags      AS "lastfmTags",
        lastfm_listeners AS "lastfmListeners",
        lastfm_playcount AS "lastfmPlaycount",
        lastfm_wiki_pt   AS "lastfmWikiPt"
      FROM "Disco" WHERE slug = ${slug}
    `,
    getRelatedDeals(disco.id),
  ]);

  const meta = metaRow[0];
  const albumInfo = meta?.lastfmListeners != null
    ? {
        listeners:   meta.lastfmListeners,
        playcount:   meta.lastfmPlaycount ?? 0,
        wikiSummary: meta.lastfmWikiPt ?? null,
      }
    : null;

  const disponivel = meta?.disponivel ?? true;
  const artistLower = disco.artista.toLowerCase();
  const styleTags = parseStyleTags(meta?.lastfmTags ?? null)
    .filter((t) => t.toLowerCase() !== artistLower)
    .slice(0, 5);

  const valores = disco.precos.map((p) => Number(p.precoBrl));
  const precoAtual = valores.at(-1) ?? 0;
  const precoMin = valores.length ? Math.min(...valores) : precoAtual;
  const precoMax = valores.length ? Math.max(...valores) : precoAtual;
  const media =
    valores.length > 0
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : precoAtual;
  const desconto = media > 0 ? ((media - precoAtual) / media) * 100 : 0;

  // Record when the historical min and max occurred
  const minRecord =
    disco.precos.length > 0
      ? disco.precos.reduce((a, b) =>
          Number(a.precoBrl) < Number(b.precoBrl) ? a : b
        )
      : null;
  const maxRecord =
    disco.precos.length > 0
      ? disco.precos.reduce((a, b) =>
          Number(a.precoBrl) > Number(b.precoBrl) ? a : b
        )
      : null;

  // 3-state price status (evaluated in priority order)
  const statusPreco: "menor" | "aumento" | "estavel" | null =
    valores.length >= 2
      ? precoAtual <= precoMin
        ? "menor"
        : precoAtual > media * 1.03
        ? "aumento"
        : "estavel"
      : null;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const BRT = "America/Sao_Paulo";

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("pt-BR", { timeZone: BRT });

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString("pt-BR", { timeZone: BRT, hour: "2-digit", minute: "2-digit" });

  const fmtDateTime = (d: Date) => `${fmtDate(d)}, ${fmtTime(d)}`;

  // Label for the "Atual" stat card — compare dates in BRT
  const dataAtual = disco.precos.at(-1)?.capturadoEm;

  const isHoje =
    dataAtual
      ? dataAtual.toLocaleDateString("pt-BR", { timeZone: BRT }) ===
        new Date().toLocaleDateString("pt-BR", { timeZone: BRT })
      : false;
  const dataAtualLabel = isHoje
    ? `Hoje, ${fmtTime(dataAtual!)}`
    : dataAtual
    ? fmtDateTime(dataAtual)
    : "—";

  const rating = disco.rating ? Number(disco.rating) : null;
  const stars = rating ? Math.round(rating) : 0;

  const chartPrecos = disco.precos.map((p) => ({
    data: p.capturadoEm.toLocaleDateString("pt-BR", {
      timeZone: BRT,
      day: "2-digit",
      month: "2-digit",
    }),
    dataFull: fmtDateTime(p.capturadoEm),
    valor: Number(p.precoBrl),
  }));

  // 30-day price minimum from already-fetched precos (no extra DB call needed)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const valores30d = disco.precos
    .filter((p) => p.capturadoEm >= thirtyDaysAgo)
    .map((p) => Number(p.precoBrl));
  const precoMin30d = valores30d.length ? Math.min(...valores30d) : null;

  // Price history displayed newest-first, with delta vs. previous capture
  const precosDisplay = [...disco.precos].reverse();
  const priceTableRows = precosDisplay.map((p) => ({
    dataFormatada: fmtDateTime(p.capturadoEm),
    preco: Number(p.precoBrl),
  }));

  const fmtCount = (n: number): string =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1).replace(".", ",")}M`
      : n >= 1_000
      ? `${Math.round(n / 1_000).toLocaleString("pt-BR")}K`
      : n.toLocaleString("pt-BR");

  // Process related deals into DiscoCard-compatible shape
  const processedDeals = relatedDeals.map((deal) => {
    let sparkline: number[] = [];
    if (Array.isArray(deal.sparkline)) {
      sparkline = (deal.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
    } else if (typeof deal.sparkline === "string") {
      try {
        sparkline = (JSON.parse(deal.sparkline) as unknown[]).map(Number).filter((n) => !isNaN(n));
      } catch {
        sparkline = [];
      }
    }
    return {
      ...deal,
      rating:          deal.rating ? Number(deal.rating) : null,
      emPromocao:      true, // query already filters deal_score IS NOT NULL
      dealScore:       deal.dealScore !== null && deal.dealScore !== undefined ? Number(deal.dealScore) : null,
      confidenceLevel: deal.confidenceLevel ?? null,
      sparkline,
    };
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

  const productJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteUrl}/disco/${slug}`,
    name: disco.titulo,
    description: `Compre ${disco.titulo} de ${disco.artista} pelo menor preço. Veja o histórico de preços e as melhores ofertas disponíveis na Amazon Brasil.`,
    sku: disco.asin,
    image: disco.imgUrl ?? undefined,
    brand: { "@type": "Brand", name: disco.artista },
    url: `${siteUrl}/disco/${slug}`,
    ...(disco.precos.length > 0
      ? { dateModified: disco.precos.at(-1)!.capturadoEm.toISOString() }
      : {}),
    offers: {
      "@type": "Offer",
      url: disco.url,
      priceCurrency: "BRL",
      price: precoAtual.toFixed(2),
      availability: disponivel
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: "Amazon Brasil" },
    },
    ...(rating && disco.reviewCount && disco.reviewCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.toFixed(1),
            reviewCount: disco.reviewCount,
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
  });

  const musicAlbumJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: disco.titulo,
    url: `${siteUrl}/disco/${slug}`,
    ...(disco.imgUrl ? { image: disco.imgUrl } : {}),
    byArtist: {
      "@type": "MusicArtist",
      name: disco.artista,
      url: `${siteUrl}/artista/${slugifyArtist(disco.artista)}`,
    },
  });

  const breadcrumbJsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: `${siteUrl}/` },
      {
        "@type": "ListItem",
        position: 2,
        name: disco.artista,
        item: `${siteUrl}/artista/${slugifyArtist(disco.artista)}`,
      },
      { "@type": "ListItem", position: 3, name: disco.titulo },
    ],
  });

  return (
    <main id="main-content" className="max-w-3xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: musicAlbumJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span>›</span>
        <Link
          href={`/artista/${slugifyArtist(disco.artista)}`}
          className="hover:text-cream transition-colors"
        >
          {disco.artista}
        </Link>
        <span>›</span>
        <span className="text-parchment truncate max-w-[200px] sm:max-w-xs">
          {disco.titulo}
        </span>
      </nav>

      {/* Hero — large album art on the left, price details on the right */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        {disco.imgUrl && (
          <div className="relative w-full sm:w-72 sm:h-72 aspect-square sm:aspect-auto shrink-0 bg-label rounded-2xl overflow-hidden">
            <Image
              src={disco.imgUrl}
              alt={`${disco.titulo} por ${disco.artista} — capa do álbum`}
              fill
              sizes="(max-width: 640px) 100vw, 288px"
              className="object-cover"
              unoptimized
              priority
            />
          </div>
        )}

        <div className="flex-1 flex flex-col justify-between">
          <div>
            <Link
              href={`/artista/${slugifyArtist(disco.artista)}`}
              className="text-parchment hover:text-gold text-sm transition-colors font-medium block py-2 -my-2"
            >
              {disco.artista}
            </Link>
            <h1 className="font-display text-2xl font-bold text-cream mt-1 leading-tight">
              {disco.titulo}
            </h1>
            {rating && (
              <div
                className="flex items-center gap-0.5 mt-2"
                role="img"
                aria-label={`Avaliação: ${rating.toFixed(1)} de 5`}
              >
                {Array.from({ length: 5 }, (_, i) => (
                  <svg
                    key={i}
                    className={`w-4 h-4 ${i < stars ? "fill-gold text-gold" : "fill-none text-groove"}`}
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
                <span className="text-dust text-sm ml-1">{rating.toFixed(1)}</span>
              </div>
            )}
            <StyleTags tags={styleTags} />
          </div>

          <div className="mt-5">
            {/* Price + discount badge */}
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-display text-4xl sm:text-5xl font-black text-gold leading-none tabular-nums">
                {fmt(precoAtual)}
              </span>
              {Math.abs(desconto) >= 1 && (
                <span
                  className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                    desconto >= 10
                      ? "bg-deal/20 text-deallit"
                      : desconto > 0
                      ? "bg-groove text-parchment"
                      : "bg-cut/20 text-cut"
                  }`}
                >
                  {desconto >= 0 ? "▼" : "▲"} {Math.abs(desconto).toFixed(1)}%
                </span>
              )}
            </div>

            {/* Only surface the deal signal — badge already conveys direction for other states */}
            {statusPreco === "menor" && (
              <span className="inline-block text-xs bg-deal text-cream font-bold px-3 py-1 rounded-full mb-1">
                ↓ Menor Preço Histórico
              </span>
            )}

            {/* Historical average */}
            <p className="text-dust text-sm">
              vs. média histórica{" "}
              <span className="text-ash">{fmt(media)}</span>
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-5">
              {disponivel ? (
                <a
                  href={disco.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gold hover:bg-goldlit text-record font-bold text-sm px-6 py-3 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-record"
                >
                  Ver na Amazon
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              ) : (
                <div className="flex flex-col gap-1">
                  <span className="inline-flex items-center gap-2 bg-groove text-dust font-bold text-sm px-6 py-3 rounded-full cursor-not-allowed border border-wax/50">
                    Indisponível na Amazon
                  </span>
                  {dataAtual && (
                    <p className="text-xs text-ash pl-1">
                      Último registro em {dataAtualLabel}
                    </p>
                  )}
                </div>
              )}
              <CopyLinkButton />
            </div>
            <p className="text-ash text-xs mt-2">
              Preços podem variar
            </p>
          </div>
        </div>
      </div>

      <TabNav
        precosContent={
          <section className="bg-sleeve rounded-xl border border-groove p-5 space-y-5">
            {/* Stat cards */}
            <dl className={`grid gap-3 ${precoMin30d !== null ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
              {/* Atual */}
              <div className="bg-groove rounded-lg p-3 border-l-4 border-gold">
                <dt className="text-xs text-dust mb-1">Atual</dt>
                <dd className="font-bold text-gold text-sm tabular-nums">{fmt(precoAtual)}</dd>
                <dd className="text-xs text-dust mt-0.5">{dataAtualLabel}</dd>
              </div>

              {/* Mín. 30 dias */}
              {precoMin30d !== null && (
                <div className="bg-groove rounded-lg p-3 border-l-4 border-deal/60">
                  <dt className="text-xs text-dust mb-1">Mín. 30 dias</dt>
                  <dd className="font-bold text-deallit text-sm tabular-nums">{fmt(precoMin30d)}</dd>
                  <dd className="text-xs text-dust mt-0.5">Últimos 30 dias</dd>
                </div>
              )}

              {/* Mín. histórico */}
              <div className="bg-groove rounded-lg p-3 border-l-4 border-deal">
                <dt className="text-xs text-dust mb-1 flex items-center gap-1">
                  Mín. histórico <span className="text-deallit text-xs font-bold">↓</span>
                </dt>
                <dd className="font-bold text-deallit text-sm tabular-nums">{fmt(precoMin)}</dd>
                {minRecord && (
                  <dd className="text-xs text-dust mt-0.5">{fmtDate(minRecord.capturadoEm)}</dd>
                )}
              </div>

              {/* Máximo */}
              <div className="bg-groove rounded-lg p-3 border-l-4 border-cut">
                <dt className="text-xs text-dust mb-1 flex items-center gap-1">
                  Máximo <span className="text-cut text-xs font-bold">↑</span>
                </dt>
                <dd className="font-bold text-cut text-sm tabular-nums">{fmt(precoMax)}</dd>
                {maxRecord && (
                  <dd className="text-xs text-dust mt-0.5">{fmtDate(maxRecord.capturadoEm)}</dd>
                )}
              </div>
            </dl>

            {/* Price chart */}
            <GraficoPreco precos={chartPrecos} />

            {/* Collapsible table */}
            {valores.length > 1 && <PriceHistoryTable rows={priceTableRows} />}
          </section>
        }
        sobreContent={
          albumInfo ? (() => {
            const cleanTitle = disco.titulo
              .replace(/\s*\[[^\]]*\]/g, "")
              .replace(/\s*\([^)]*\)/g, (m) =>
                /\b(vinyl|vinil|lp|gram|colored|colou?red|remaster|reissue|gatefold|splatter|exclusive|amazon|180|140|clear|gold|green|silver|blue|red|black|white|orange|purple|pink|yellow|repress|anniversary|deluxe|edition)\b/i.test(m) ? "" : m
              )
              .replace(new RegExp(`^${disco.artista.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*-\\s*`, "i"), "")
              .trim();
            const lastfmUrl = `https://www.last.fm/music/${encodeURIComponent(disco.artista)}/${encodeURIComponent(cleanTitle)}`;
            return (
              <section className="space-y-4">
                {/* Last.fm stats + attribution header */}
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-cream">Sobre o álbum</h2>
                  <a
                    href={lastfmUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="text-xs text-dust hover:text-parchment transition-colors flex items-center gap-1"
                    aria-label={`Ver ${disco.titulo} no Last.fm`}
                  >
                    Dados: Last.fm ↗
                  </a>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-sleeve rounded-xl border border-groove p-4">
                    <p className="text-xs text-dust mb-1">Ouvintes</p>
                    <p className="font-display font-bold text-cream text-2xl">{fmtCount(albumInfo.listeners)}</p>
                  </div>
                  <div className="bg-sleeve rounded-xl border border-groove p-4">
                    <p className="text-xs text-dust mb-1">Reproduções</p>
                    <p className="font-display font-bold text-cream text-2xl">{fmtCount(albumInfo.playcount)}</p>
                  </div>
                </div>

                {albumInfo.wikiSummary && (
                  <div className="bg-sleeve rounded-xl border border-groove p-4">
                    <WikiExpander text={albumInfo.wikiSummary} />
                  </div>
                )}

                {rating && disco.reviewCount && disco.reviewCount > 0 && (
                  <div className="bg-sleeve rounded-xl border border-groove p-4">
                    <h3 className="text-xs font-semibold text-dust uppercase tracking-wide mb-3">Avaliação na Amazon</h3>
                    <div className="flex items-center gap-3">
                      <span className="font-display font-black text-gold text-3xl">{rating.toFixed(1)}</span>
                      <div>
                        <div className="flex items-center gap-0.5 mb-0.5">
                          {Array.from({ length: 5 }, (_, i) => (
                            <svg
                              key={i}
                              className={`w-3.5 h-3.5 ${i < stars ? "fill-gold text-gold" : "fill-none text-groove"}`}
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              aria-hidden="true"
                            >
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ))}
                        </div>
                        <p className="text-xs text-dust">{disco.reviewCount.toLocaleString("pt-BR")} avaliações</p>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })() : undefined
        }
      />

      {/* Related deals */}
      {processedDeals.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold text-cream mb-4">
            Outros discos em oferta
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {processedDeals.map((deal) => (
              <DiscoCard key={deal.id} disco={deal} />
            ))}
          </div>
        </section>
      )}

      <BackToTop />
    </main>
  );
}
