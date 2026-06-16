import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GraficoPreco from "@/components/GraficoPreco";
import DiscoCard from "@/components/DiscoCard";
import BackToTop from "@/components/BackToTop";
import PriceHistoryTable from "@/components/PriceHistoryTable";
import CopyLinkButton from "@/components/CopyLinkButton";
import TabNav from "@/components/TabNav";
import WikiExpander from "@/components/WikiExpander";

// Matches the flag in DiscoCard.tsx — see that file for full rationale.
const HIDE_PRICE_HISTORY = process.env.NEXT_PUBLIC_HIDE_PRICE_HISTORY !== "false";
import { affiliateUrl } from "@/lib/affiliateUrl";
import { slugifyArtist } from "@/lib/utils/slugify";
import { parseStyleTags, slugifyStyle } from "@/lib/utils/styleUtils";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { cleanAlbumTitle } from "@/lib/external/lastfmAlbum";
import { getDiscoWithPrecos, getDiscoMeta, getRelatedDeals, type RelatedDeal } from "@/lib/db/disco";
import { getHreflangRecord } from "@/lib/db/hreflang";
import { PEER_ORIGIN } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";

// Safety net only — the crawler's /api/revalidate webhook is the real trigger.
// 1800 matches the data-layer TTL so the HTML cache never outlives its data.
export const revalidate = 1800;

export default async function DiscoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // getDiscoWithPrecos is React-cached — generateMetadata's prior call is free.
  const disco = await getDiscoWithPrecos(slug);
  if (!disco) notFound();
  // Excluded non-vinyl records (CD incident, 2026-06-11) return 404 —
  // never 200 with empty content, never a redirect.
  if (disco.format && disco.format !== "vinyl") notFound();

  // lastfm_* columns are crawler-enriched and read directly from DB — no runtime API calls.
  const meta = await getDiscoMeta(slug);
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

  const relatedDeals = await getRelatedDeals(disco.id, styleTags);
  // Peer-site album URL for MusicAlbum.sameAs (same pressing, other market).
  const peerSlug = await getHreflangRecord(disco.asin).catch(() => null);

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

  // Metadata — computed here so React 19 hoists <title>/<meta> to <head> in SSR
  const tituloLimpo = cleanAlbumTitle(disco.titulo, disco.artista) || disco.titulo;
  const isUnknownArtistDisco = disco.artista.toLowerCase() === "artista não identificado";
  const includeArtist = !isUnknownArtistDisco && !tituloLimpo.toLowerCase().includes(disco.artista.toLowerCase());
  const base = includeArtist ? `${tituloLimpo} em Vinil — ${disco.artista}` : `${tituloLimpo} em Vinil`;
  let metaTitle = `${base} | Garimpa Vinil`;
  if (metaTitle.length > 60) metaTitle = base;
  if (metaTitle.length > 60 && includeArtist) metaTitle = `${tituloLimpo} em Vinil`;
  if (metaTitle.length > 60) metaTitle = `${truncateTitle(tituloLimpo, 51)} em Vinil`;
  const fmtR = (v: number) => `R$ ${Math.round(v)}`;
  let metaDesc: string;
  if (!precoAtual) {
    metaDesc = `${tituloLimpo} em vinil: acompanhe o preço na Amazon e veja o histórico de 12 meses antes de comprar.`;
  } else if (valores.length < 2) {
    metaDesc = `${tituloLimpo} em vinil a ${fmtR(precoAtual)} na Amazon. Acompanhe o histórico de preços e o gráfico de 12 meses antes de comprar.`;
  } else if (precoMin < precoAtual && minRecord) {
    const mes = minRecord.capturadoEm.toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
    metaDesc = `${tituloLimpo} em vinil a ${fmtR(precoAtual)} na Amazon. Menor preço já registrado: ${fmtR(precoMin)} em ${mes}. Gráfico de 12 meses pra decidir a hora de comprar.`;
  } else {
    const rel = precoAtual < media * 0.98 ? `abaixo da média de ${fmtR(media)}` : precoAtual > media * 1.02 ? `acima da média de ${fmtR(media)}` : `na média de ${fmtR(media)}`;
    metaDesc = `Vinil de ${tituloLimpo} a ${fmtR(precoAtual)} na Amazon, ${rel} dos últimos 12 meses. Veja o gráfico antes de comprar.`;
  }
  metaDesc = truncateDesc(metaDesc);
  const discoCanonicalUrl = `${SITE_URL}/disco/${slug}`;

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

  const siteUrl = SITE_URL;

  const productJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteUrl}/disco/${slug}`,
    name: disco.titulo,
    description: `Compre ${disco.titulo} de ${disco.artista} pelo menor preço. Veja o histórico de preços e as melhores ofertas disponíveis na Amazon Brasil.`,
    sku: disco.asin,
    image: disco.imgUrl ?? undefined,
    brand: { "@type": "Brand", name: disco.artista },
    url: `${siteUrl}/disco/${slug}`,
    offers: {
      "@type": "Offer",
      url: disco.url,
      priceCurrency: "BRL",
      price: precoAtual.toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
      // Crawler refreshes several times daily; +24h is a conservative horizon.
      priceValidUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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

  const musicAlbumJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    "@id": `${siteUrl}/disco/${slug}#album`,
    name: disco.titulo,
    url: `${siteUrl}/disco/${slug}`,
    ...(peerSlug ? { sameAs: [`${PEER_ORIGIN}/record/${peerSlug}`] } : {}),
    ...(disco.imgUrl ? { image: disco.imgUrl } : {}),
    byArtist: {
      "@type": "MusicGroup",
      name: disco.artista,
      url: `${siteUrl}/artista/${slugifyArtist(disco.artista)}`,
    },
  });

  const breadcrumbJsonLd = toJsonLd({
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

  // Price FAQ — programmatic Q&A from the price history we already computed.
  // Rendered visibly below and mirrored in FAQPage JSON-LD (required by Google).
  const faqItems =
    valores.length >= 2
      ? [
          {
            q: `Qual o menor preço já registrado de ${disco.titulo} em vinil?`,
            a: disponivel
              ? `O menor preço registrado foi ${fmt(precoMin)}${minRecord ? `, em ${fmtDate(minRecord.capturadoEm)}` : ""}. O preço atual é ${fmt(precoAtual)}.`
              : `O menor preço registrado foi ${fmt(precoMin)}${minRecord ? `, em ${fmtDate(minRecord.capturadoEm)}` : ""}. Este disco está indisponível na Amazon no momento.`,
          },
          ...(disponivel
            ? [
                {
                  q: `O preço de ${disco.titulo} está bom agora?`,
                  a:
                    statusPreco === "menor"
                      ? `Sim — ${fmt(precoAtual)} é o menor preço já registrado pelo nosso monitoramento para este disco.`
                      : statusPreco === "aumento"
                      ? `O preço atual (${fmt(precoAtual)}) está acima da média histórica de ${fmt(media)}. Pode valer a pena esperar uma queda.`
                      : `O preço atual (${fmt(precoAtual)}) está próximo da média histórica de ${fmt(media)}.`,
                },
                {
                  q: `Com que frequência o preço de ${disco.titulo} é verificado?`,
                  a: `O preço é verificado automaticamente várias vezes ao dia na Amazon Brasil. Já registramos ${valores.length} capturas de preço para este disco.`,
                },
              ]
            : []),
        ]
      : [];

  const faqJsonLd =
    faqItems.length > 0
      ? toJsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })
      : null;

  return (
    <>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDesc} />
      <link rel="canonical" href={discoCanonicalUrl} />
      <meta property="og:type" content="music.album" />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:url" content={discoCanonicalUrl} />
      <meta property="og:image" content={disco.imgUrl ?? `${SITE_URL}/og-default.png`} />
      <meta name="twitter:card" content={disco.imgUrl ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image" content={disco.imgUrl ?? `${SITE_URL}/og-default.png`} />
      {peerSlug && (
        <>
          <link rel="alternate" hrefLang="pt-BR" href={discoCanonicalUrl} />
          <link rel="alternate" hrefLang="en-US" href={`${PEER_ORIGIN}/record/${peerSlug}`} />
          <link rel="alternate" hrefLang="x-default" href={`${PEER_ORIGIN}/record/${peerSlug}`} />
        </>
      )}
      <main id="main-content" className="max-w-5xl mx-auto px-4 py-8">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: productJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: musicAlbumJsonLd }} />
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      {faqJsonLd && (
        // eslint-disable-next-line react/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd }} />
      )}
      {/* Breadcrumbs */}
      <nav aria-label="Navegação estrutural" className="flex items-center gap-1.5 text-sm text-dust mb-6 flex-wrap">
        <Link href="/" className="hover:text-cream transition-colors">
          Início
        </Link>
        <span aria-hidden="true">›</span>
        <Link
          href={`/artista/${slugifyArtist(disco.artista)}`}
          className="hover:text-cream transition-colors"
        >
          {disco.artista}
        </Link>
        <span aria-hidden="true">›</span>
        <span className="text-parchment truncate max-w-[200px] sm:max-w-xs">
          {disco.titulo}
        </span>
      </nav>

      {/* Hero — sticky album art left, details right on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-6">

        {disco.imgUrl && (
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[82px]">
              {/* Offset shadow layer — stacked sleeve effect */}
              <div className="relative">
                <div className="absolute inset-0 translate-x-3 translate-y-3 bg-groove border border-wax/40 rounded-2xl" aria-hidden="true" />
                <div className="relative aspect-square bg-label rounded-2xl overflow-hidden">
                  <Image
                    src={disco.imgUrl}
                    alt={`${disco.titulo} por ${disco.artista} — capa do álbum`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 480px"
                    className="object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className={`flex flex-col justify-between ${disco.imgUrl ? "lg:col-span-7" : "lg:col-span-12"}`}>
          <div>
            {/* Single meta line: artist · genre */}
            <p className="text-dust text-[11px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 flex-wrap">
              <Link
                href={`/artista/${slugifyArtist(disco.artista)}`}
                className="hover:text-parchment transition-colors"
              >
                {disco.artista}
              </Link>
              {styleTags.length > 0 && (
                <>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  {styleTags.map((tag, i) => (
                    <span key={tag} className="contents">
                      {i > 0 && <span aria-hidden="true" className="opacity-40">/</span>}
                      <Link
                        href={`/estilo/${slugifyStyle(tag)}`}
                        className="hover:text-parchment transition-colors"
                      >
                        {tag}
                      </Link>
                    </span>
                  ))}
                </>
              )}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black text-cream leading-tight mb-3 [text-wrap:balance]">
              {disco.titulo}
            </h1>
            {rating && (
              <div
                className="flex items-center gap-0.5"
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
          </div>

          {/* Price block */}
          <div className="mt-4">
            {/* Price */}
            <span className="font-display text-3xl sm:text-4xl font-black text-gold leading-none tabular-nums block mb-1">
              {fmt(precoAtual)}
            </span>

            {/* Avg reference + delta — shown on product page regardless of HIDE_PRICE_HISTORY */}
            {media > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-dust text-sm tabular-nums">
                  Média: {fmt(media)}
                </span>
                {Math.abs(desconto) >= 1 && (
                  <span className={`text-xs font-bold ${
                    desconto >= 1 ? "text-deallit" : "text-cut"
                  }`}>
                    {desconto >= 0
                      ? `↓ ${Math.abs(desconto).toFixed(1)}%`
                      : `↑ ${Math.abs(desconto).toFixed(1)}%`}
                  </span>
                )}
              </div>
            )}

            {/* CTA */}
            {disponivel ? (
              <>
                <a
                  href={affiliateUrl(disco.url)}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full bg-gold hover:bg-goldlit text-record font-bold text-sm py-4 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-record"
                >
                  Ver na Amazon
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-ash text-xs">Preços podem variar · <span className="text-dust/60">#anúncio</span></p>
                  <CopyLinkButton />
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-center bg-groove text-dust font-bold text-sm py-4 rounded-xl cursor-not-allowed border border-wax/50">
                  Indisponível na Amazon
                </div>
                {dataAtual && (
                  <p className="text-xs text-ash pl-1">Último registro em {dataAtualLabel}</p>
                )}
                <div className="flex justify-end">
                  <CopyLinkButton />
                </div>
              </div>
            )}

            {/* Stats bar — suppressed when HIDE_PRICE_HISTORY */}
            {!HIDE_PRICE_HISTORY && (
              <dl className="flex items-stretch bg-sleeve rounded-xl border border-groove mt-3 overflow-hidden">
                <div className="flex-1 px-3 py-3 min-w-0">
                  <dt className="text-[9px] text-dust uppercase tracking-wide mb-1">Atual</dt>
                  <dd className="font-bold text-gold tabular-nums text-xs sm:text-sm">{fmt(precoAtual)}</dd>
                  <dd className="text-[9px] text-dust mt-0.5 truncate">{dataAtualLabel}</dd>
                </div>
                <div className="w-px bg-groove self-stretch" aria-hidden="true" />
                <div className="flex-1 px-3 py-3 min-w-0">
                  <dt className="text-[9px] text-dust uppercase tracking-wide mb-1 flex items-center gap-0.5">
                    Mín. <span className="text-deallit">↓</span>
                  </dt>
                  <dd className="font-bold text-deallit tabular-nums text-xs sm:text-sm">{fmt(precoMin)}</dd>
                  {minRecord && <dd className="text-[9px] text-dust mt-0.5">{fmtDate(minRecord.capturadoEm)}</dd>}
                </div>
                <div className="w-px bg-groove self-stretch" aria-hidden="true" />
                <div className="flex-1 px-3 py-3 min-w-0">
                  <dt className="text-[9px] text-dust uppercase tracking-wide mb-1 flex items-center gap-0.5">
                    Máx. <span className="text-cut">↑</span>
                  </dt>
                  <dd className="font-bold text-cut tabular-nums text-xs sm:text-sm">{fmt(precoMax)}</dd>
                  {maxRecord && <dd className="text-[9px] text-dust mt-0.5">{fmtDate(maxRecord.capturadoEm)}</dd>}
                </div>
              </dl>
            )}
          </div>
        </div>
      </div>

      {(() => {
        const sobreSection = albumInfo ? (() => {
          const cleanTitle = cleanAlbumTitle(disco.titulo, disco.artista);
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
        })() : undefined;

        if (HIDE_PRICE_HISTORY) {
          // Price history hidden — render Sobre content directly, no tabs, no empty Preços tab.
          return sobreSection ?? null;
        }

        return (
          <TabNav
            precosContent={
              <section className="bg-sleeve rounded-xl border border-groove p-4 space-y-3">
                <GraficoPreco precos={chartPrecos} />
                {valores.length > 1 && <PriceHistoryTable rows={priceTableRows} />}
              </section>
            }
            sobreContent={sobreSection}
          />
        );
      })()}

      {/* Price FAQ — visible counterpart of the FAQPage JSON-LD */}
      {faqItems.length > 0 && (
        <section className="mt-6 bg-sleeve rounded-xl border border-groove p-4">
          <h2 className="font-display text-2xl font-black text-cream italic mb-3">
            Perguntas frequentes sobre o preço
          </h2>
          <dl className="space-y-3">
            {faqItems.map((f) => (
              <div key={f.q}>
                <dt className="text-cream text-sm font-bold">{f.q}</dt>
                <dd className="text-parchment text-sm mt-0.5">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Related deals */}
      {processedDeals.length > 0 && (
        <section className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-2xl font-black text-cream italic">
              Outros discos em oferta
            </h2>
            <Link
              href="/disco"
              className="text-[11px] font-bold uppercase tracking-widest text-dust hover:text-gold transition-colors"
            >
              Ver Todos
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {processedDeals.map((deal) => (
              <DiscoCard key={deal.id} disco={deal} />
            ))}
          </div>
        </section>
      )}

      <BackToTop />
    </main>
    </>
  );
}
