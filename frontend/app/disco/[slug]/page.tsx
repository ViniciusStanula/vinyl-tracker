import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import GraficoPreco from "@/components/GraficoPreco";
import DiscoCard from "@/components/DiscoCard";
import BackToTop from "@/components/BackToTop";
import GuiasRelacionados from "@/components/GuiasRelacionados";
import PriceHistoryTable from "@/components/PriceHistoryTable";
import CopyLinkButton from "@/components/CopyLinkButton";
import AlertaTrigger from "@/components/AlertaTrigger";
import TabNav from "@/components/TabNav";
import WikiExpander from "@/components/WikiExpander";
import Tracklist from "@/components/Tracklist";

// Matches the flag in DiscoCard.tsx — see that file for full rationale.
const HIDE_PRICE_HISTORY = process.env.NEXT_PUBLIC_HIDE_PRICE_HISTORY !== "false";
import { affiliateUrl } from "@/lib/affiliateUrl";
import { slugifyArtist } from "@/lib/utils/slugify";
import { parseStyleTags, slugifyStyle } from "@/lib/utils/styleUtils";
import { truncateTitle, truncateDesc } from "@/lib/utils/seo";
import { cleanAlbumTitle } from "@/lib/external/lastfmAlbum";
import { getDiscoWithPrecos, getDiscoMeta, getRelatedDeals, getArtistPopularity, getArtistTopAlbums, getTopBotHitSlugs, type RelatedDeal } from "@/lib/db/disco";
import { getEstilosList } from "@/lib/db/estilo";
import { getPaisDisplayName, ISO2_TO_SLUG } from "@/lib/paises";
import { getHreflangRecord } from "@/lib/db/hreflang";
import { PEER_ORIGIN } from "@/lib/hreflang";
import { SITE_URL } from "@/lib/siteUrl";
import { toJsonLd } from "@/lib/jsonld";
import type { Metadata } from "next";

// Safety net only — the crawler's /api/revalidate webhook is the real trigger.
// 1800 matches the data-layer TTL so the HTML cache never outlives its data.
export const revalidate = 14400;

// Prebuilds the pages Googlebot/bots actually hit most (bot_hits-ranked), so
// their first visit is CDN-served instead of a cold DB render — the rest of
// the ~30k-slug catalog still renders on first request same as before.
// dynamicParams stays true (default) so every slug is allowed either way;
// revalidateTag("prices") + the 24h safety-net above apply identically
// whether a page was prebuilt here or rendered on-demand later.
export async function generateStaticParams() {
  return (await getTopBotHitSlugs("/disco/", 3000)).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const disco = await getDiscoWithPrecos(slug).catch(() => null);
  if (!disco || (disco.format && disco.format !== "vinyl")) {
    return { title: "Disco de Vinil | Garimpa Vinil" };
  }

  const peerSlug = await getHreflangRecord(disco.asin).catch(() => null);

  const tituloLimpo = cleanAlbumTitle(disco.titulo, disco.artista) || disco.titulo;
  const isUnknownArtistDisco = disco.artista.toLowerCase() === "artista não identificado";
  const includeArtist = !isUnknownArtistDisco && !tituloLimpo.toLowerCase().includes(disco.artista.toLowerCase());
  const base = includeArtist ? `${tituloLimpo} em Vinil — ${disco.artista}` : `${tituloLimpo} em Vinil`;
  let title = `${base} | Garimpa Vinil`;
  if (title.length > 60) title = base;
  if (title.length > 60 && includeArtist) title = `${tituloLimpo} em Vinil`;
  if (title.length > 60) title = `${truncateTitle(tituloLimpo, 51)} em Vinil`;

  const valores = disco.precos.map((p) => Number(p.precoBrl));
  const precoAtual = valores.at(-1) ?? 0;
  const precoMin = valores.length ? Math.min(...valores) : precoAtual;
  const media = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : precoAtual;
  // Average comparison uses avg_30d (recent), not the 12-month mean — the latter is
  // skewed high by old outlier prices. Matches the on-page Média line and FAQ.
  const avg30d = disco.avg30d != null ? Number(disco.avg30d) : media;
  const minRecord = disco.precos.length > 0
    ? disco.precos.reduce((a, b) => Number(a.precoBrl) < Number(b.precoBrl) ? a : b)
    : null;
  const statusPreco: "menor" | "aumento" | "estavel" | null =
    valores.length >= 2
      ? precoAtual <= precoMin ? "menor" : precoAtual > media * 1.03 ? "aumento" : "estavel"
      : null;

  const fmtR = (v: number) => `R$ ${Math.round(v)}`;
  const loja = disco.marketplace === "mercadolivre" ? "no Mercado Livre" : "na Amazon";
  let description: string;
  if (!precoAtual) {
    description = `${tituloLimpo} em vinil: acompanhe o preço ${loja} e veja o histórico de 12 meses antes de comprar.`;
  } else if (valores.length < 2) {
    description = `${tituloLimpo} em vinil a ${fmtR(precoAtual)} ${loja}. Acompanhe o histórico de preços e o gráfico de 12 meses antes de comprar.`;
  } else if (precoMin < precoAtual && minRecord) {
    const mes = minRecord.capturadoEm.toLocaleDateString("pt-BR", { month: "long", timeZone: "America/Sao_Paulo" });
    description = `${tituloLimpo} em vinil a ${fmtR(precoAtual)} ${loja}. Menor preço já registrado: ${fmtR(precoMin)} em ${mes}. Gráfico de 12 meses pra decidir a hora de comprar.`;
  } else {
    const rel = precoAtual < avg30d * 0.98 ? `abaixo da média de ${fmtR(avg30d)}` : precoAtual > avg30d * 1.02 ? `acima da média de ${fmtR(avg30d)}` : `na média de ${fmtR(avg30d)}`;
    description = `Vinil de ${tituloLimpo} a ${fmtR(precoAtual)} ${loja}, ${rel} dos últimos 30 dias. Veja o gráfico antes de comprar.`;
  }
  description = truncateDesc(description);
  const canonicalUrl = `${SITE_URL}/disco/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      ...(peerSlug
        ? {
            languages: {
              "pt-BR": canonicalUrl,
              "en-US": `${PEER_ORIGIN}/record/${peerSlug}`,
              "x-default": `${PEER_ORIGIN}/record/${peerSlug}`,
            },
          }
        : {}),
    },
    openGraph: {
      type: "music.album",
      title,
      description,
      url: canonicalUrl,
      images: [disco.imgUrl ?? `${SITE_URL}/og-default.png`],
    },
    twitter: {
      card: disco.imgUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: [disco.imgUrl ?? `${SITE_URL}/og-default.png`],
    },
  };
}

export default async function DiscoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // getDiscoWithPrecos is React-cached — generateMetadata's prior call is free.
  // getDiscoMeta only needs the slug, so it runs in the same round-trip wave;
  // on cold long-tail renders every await here is a real DB round trip.
  // lastfm_* columns are crawler-enriched and read directly from DB — no runtime API calls.
  const [disco, meta] = await Promise.all([
    getDiscoWithPrecos(slug),
    getDiscoMeta(slug),
  ]);
  if (!disco) notFound();
  // Excluded non-vinyl records (CD incident, 2026-06-11) return 404 —
  // never 200 with empty content, never a redirect.
  if (disco.format && disco.format !== "vinyl") notFound();
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

  // Everything below depends only on disco/meta, so it's one parallel wave —
  // sequential awaits here cost a full DB round trip each on cold renders.
  const [estilosList, relatedDeals, popularity, artistAlbums, peerSlug] = await Promise.all([
    // Genres link to /estilo/[slug] only when a style page actually exists for
    // that slug (style pages are derived from lastfm_tags, not MB genres).
    meta?.mbMbid ? getEstilosList() : Promise.resolve([]),
    getRelatedDeals(disco.id, styleTags),
    // Rank of this album among the artist's tracked vinyls, by Last.fm listeners.
    (meta?.lastfmListeners ?? 0) > 0
      ? getArtistPopularity(disco.artista, slug)
      : Promise.resolve(null),
    // Other vinyls by the same artist (most-listened first) for a dedicated rail.
    artistLower === "artista não identificado"
      ? Promise.resolve([])
      : getArtistTopAlbums(disco.artista, disco.id),
    // Peer-site album URL for MusicAlbum.sameAs (same pressing, other market).
    getHreflangRecord(disco.asin).catch(() => null),
  ]);

  // MusicBrainz release-group facts (mb_mbid = "" means searched, no match).
  const validStyleSlugs = new Set(estilosList.map((e) => e.slug));
  // "Single" is frequently a wrong release-group match — hide it rather than
  // surface a likely-mislabeled type. Localize the rest to pt-BR.
  const MB_TYPE_PT: Record<string, string> = { Album: "Álbum", EP: "EP", Compilation: "Coletânea" };
  const mbInfo = meta?.mbMbid
    ? {
        releaseYear: meta.mbFirstReleaseDate?.slice(0, 4) ?? null,
        primaryType: meta.mbPrimaryType ? MB_TYPE_PT[meta.mbPrimaryType] ?? null : null,
        genres: (meta.mbGenres ?? "")
          .split(", ")
          .filter(Boolean)
          .slice(0, 3)
          .map((name) => {
            const slug = slugifyStyle(name);
            return { name, slug: validStyleSlugs.has(slug) ? slug : null };
          }),
        // Community rating (0–5). Hide low-vote noise — needs >=10 votes.
        rating:
          meta.mbRating != null && (meta.mbRatingVotes ?? 0) >= 10
            ? { value: meta.mbRating, votes: meta.mbRatingVotes as number }
            : null,
        tracklist: ((): { title: string; length: number | null }[] => {
          try {
            const parsed = JSON.parse(meta.mbTracklist ?? "[]");
            if (!Array.isArray(parsed)) return [];
            // New format: [{title, length}]. Legacy format: [string].
            return parsed.map((t) =>
              typeof t === "string" ? { title: t, length: null } : t
            );
          } catch {
            return [];
          }
        })(),
        url: `https://musicbrainz.org/release-group/${meta.mbMbid}`,
      }
    : null;

  // Artist country of origin (from MusicBrainz via ArtistMeta), rendered as a
  // PT-BR-named link to the /pais/<slug> listing. Independent of the release
  // match — only shown when both the ISO code and a known PT name resolve.
  const artistPais =
    meta?.artistCountry && getPaisDisplayName(meta.artistCountry)
      ? { nome: getPaisDisplayName(meta.artistCountry)!, slug: ISO2_TO_SLUG[meta.artistCountry] }
      : null;

  const valores = disco.precos.map((p) => Number(p.precoBrl));
  const precoAtual = valores.at(-1) ?? 0;
  const precoMin = valores.length ? Math.min(...valores) : precoAtual;
  const precoMax = valores.length ? Math.max(...valores) : precoAtual;
  const media =
    valores.length > 0
      ? valores.reduce((a, b) => a + b, 0) / valores.length
      : precoAtual;
  // The price delta and the "está bom agora" FAQ measure against the 30-day average
  // (avg_30d) — the same reference the cards and the deal scorer use — not the
  // 12-month average, which is skewed high by old outlier prices and would imply
  // discounts on records that aren't actually cheaper than recently.
  const avg30d = disco.avg30d != null ? Number(disco.avg30d) : media;
  const desconto30d = avg30d > 0 ? ((avg30d - precoAtual) / avg30d) * 100 : 0;

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

  // 4-state price status (evaluated in priority order), judged against avg_30d —
  // "is it cheaper than recently", matching the badge/deal scorer.
  const statusPreco: "menor" | "aumento" | "abaixo" | "estavel" | null =
    valores.length >= 2
      ? precoAtual <= precoMin
        ? "menor"
        : precoAtual > avg30d * 1.03
        ? "aumento"
        : precoAtual < avg30d * 0.97
        ? "abaixo"
        : "estavel"
      : null;

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  // pt-BR percent, one decimal — used by the discount badge and the Média delta.
  const fmtPct = (v: number) => `${v.toFixed(1).replace(".", ",")}%`;

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

  // Shape a RelatedDeal row into the DiscoCard-compatible object.
  const toCard = (deal: RelatedDeal) => {
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
    const dealScore = deal.dealScore !== null && deal.dealScore !== undefined ? Number(deal.dealScore) : null;
    return {
      ...deal,
      rating:          deal.rating ? Number(deal.rating) : null,
      emPromocao:      dealScore !== null,
      dealScore,
      confidenceLevel: deal.confidenceLevel ?? null,
      sparkline,
    };
  };
  const processedDeals = relatedDeals.map(toCard);
  const processedArtistAlbums = artistAlbums.map(toCard);

  const siteUrl = SITE_URL;

  // Blend the Amazon and MusicBrainz ratings into one weighted aggregate. When
  // only one source exists, the "blend" is just that source. Shared by the
  // Product and MusicAlbum schemas so the page never exposes two conflicting
  // aggregateRatings for the same item.
  const ratingParts: { label: string; value: number; count: number }[] = [
    ...(rating && disco.reviewCount ? [{ label: "Amazon", value: rating, count: disco.reviewCount }] : []),
    ...(mbInfo?.rating ? [{ label: "MusicBrainz", value: mbInfo.rating.value, count: mbInfo.rating.votes }] : []),
  ];
  const totalVotes = ratingParts.reduce((n, r) => n + r.count, 0);
  const blendedRating =
    totalVotes > 0
      ? ratingParts.reduce((n, r) => n + r.value * r.count, 0) / totalVotes
      : null;
  // ratingCount (not reviewCount): the aggregate mixes Amazon reviews with
  // MusicBrainz community ratings, so "ratings" is the accurate umbrella term.
  const aggregateRatingLd =
    blendedRating != null
      ? {
          "@type": "AggregateRating",
          ratingValue: Number(blendedRating.toFixed(1)),
          ratingCount: totalVotes,
          bestRating: "5",
          worstRating: "1",
        }
      : null;

  const productJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${siteUrl}/disco/${slug}`,
    name: disco.titulo,
    description: `Compre ${disco.titulo} de ${disco.artista} pelo menor preço. Veja o histórico de preços e as melhores ofertas disponíveis ${disco.marketplace === "mercadolivre" ? "no Mercado Livre Brasil" : "na Amazon Brasil"}.`,
    sku: disco.asin,
    image: disco.imgUrl ?? undefined,
    brand: { "@type": "Brand", name: disco.artista },
    url: `${siteUrl}/disco/${slug}`,
    offers: {
      "@type": "Offer",
      // Route through affiliateUrl() like the buy button does: the stored
      // Disco.url can carry a stale/wrong Associates tag, and the raw value
      // would leak it into the schema.
      url: affiliateUrl(disco.url, disco.marketplace),
      priceCurrency: "BRL",
      price: precoAtual.toFixed(2),
      itemCondition: "https://schema.org/NewCondition",
      // +30d horizon: the crawler refreshes prices daily, but a short window
      // forced Google to re-crawl every product just to keep the offer's
      // priceValidUntil from lapsing. The price is still current (revalidated on
      // change); this only bounds the schema's validity claim conservatively.
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      availability: disponivel
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      seller: { "@type": "Organization", name: disco.marketplace === "mercadolivre" ? "Mercado Livre Brasil" : "Amazon Brasil" },
    },
    ...(aggregateRatingLd ? { aggregateRating: aggregateRatingLd } : {}),
  });

  // ISO 8601 track duration from MusicBrainz millisecond lengths, e.g. PT4M29S.
  const msToIso = (ms: number): string => {
    const s = Math.round(ms / 1000);
    return `PT${Math.floor(s / 60)}M${s % 60}S`;
  };
  const albumGenres = (mbInfo?.genres.map((g) => g.name) ?? []).length
    ? mbInfo!.genres.map((g) => g.name)
    : styleTags;

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
    ...(meta?.mbFirstReleaseDate ? { datePublished: meta.mbFirstReleaseDate } : {}),
    ...(albumGenres.length ? { genre: albumGenres } : {}),
    ...(mbInfo && mbInfo.tracklist.length
      ? {
          numTracks: mbInfo.tracklist.length,
          track: mbInfo.tracklist.map((t, i) => ({
            "@type": "MusicRecording",
            "@id": `${siteUrl}/disco/${slug}#track-${i + 1}`,
            name: t.title,
            ...(t.length ? { duration: msToIso(t.length) } : {}),
          })),
        }
      : {}),
    ...(aggregateRatingLd ? { aggregateRating: aggregateRatingLd } : {}),
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
  // Use the cleaned album name (same as the page title) so questions read
  // "... de What Color Is Love ..." not "... de LP What Color Is Love [Vinyl] ...".
  const tituloLimpo = cleanAlbumTitle(disco.titulo, disco.artista) || disco.titulo;
  const faqItems =
    valores.length >= 2
      ? [
          {
            q: `Qual o menor preço já registrado de ${tituloLimpo} em vinil?`,
            a: disponivel
              ? `O menor preço registrado foi ${fmt(precoMin)}${minRecord ? `, em ${fmtDate(minRecord.capturadoEm)}` : ""}. O preço atual é ${fmt(precoAtual)}.`
              : `O menor preço registrado foi ${fmt(precoMin)}${minRecord ? `, em ${fmtDate(minRecord.capturadoEm)}` : ""}. Este disco está indisponível ${disco.marketplace === "mercadolivre" ? "no Mercado Livre" : "na Amazon"} no momento.`,
          },
          ...(disponivel
            ? [
                {
                  q: `O preço de ${tituloLimpo} está bom agora?`,
                  a:
                    statusPreco === "menor"
                      ? `Sim — ${fmt(precoAtual)} é o menor preço já registrado pelo nosso monitoramento para este disco.`
                      : statusPreco === "aumento"
                      ? `O preço atual (${fmt(precoAtual)}) está acima da média dos últimos 30 dias (${fmt(avg30d)}). Pode valer a pena esperar uma queda.`
                      : statusPreco === "abaixo"
                      ? `Sim — o preço atual (${fmt(precoAtual)}) está abaixo da média dos últimos 30 dias (${fmt(avg30d)}). Bom momento para comprar.`
                      : `O preço atual (${fmt(precoAtual)}) está próximo da média dos últimos 30 dias (${fmt(avg30d)}).`,
                },
                {
                  q: `Com que frequência o preço de ${tituloLimpo} é verificado?`,
                  a: `O preço é verificado automaticamente ${disco.marketplace === "mercadolivre" ? "no Mercado Livre Brasil" : "na Amazon Brasil"}. Já registramos ${valores.length} capturas de preço para este disco.`,
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
      <div className="max-w-5xl mx-auto px-4 py-8">
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

      <article>
      {/* Hero — sticky album art left, details right on desktop */}
      <header className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 mb-6">

        {disco.imgUrl && (
          <div className="lg:col-span-5">
            <div className="lg:sticky lg:top-[82px]">
              {/* Offset shadow layer — stacked sleeve effect */}
              <div className="relative">
                <div className="absolute inset-0 translate-x-3 translate-y-3 bg-groove border border-wax/40 rounded-2xl" aria-hidden="true" />
                <div className="relative aspect-square bg-label rounded-2xl overflow-hidden">
                  <Image
                    src={disco.imgUrl}
                    alt={`${disco.titulo} por ${disco.artista}, capa do álbum`}
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
          </div>

          {/* Price block */}
          <div className="mt-4">
            {/* Price */}
            <span className="font-display text-3xl sm:text-4xl font-black text-gold leading-none tabular-nums block mb-1">
              {fmt(precoAtual)}
            </span>

            {/* Avg reference + delta — 30-day avg, same reference as the badge above */}
            {avg30d > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-dust text-sm tabular-nums">
                  Média: {fmt(avg30d)}
                </span>
                {Math.abs(desconto30d) >= 1 && (
                  <span className={`text-xs font-bold ${
                    desconto30d >= 1 ? "text-deallit" : "text-cut"
                  }`}>
                    {desconto30d >= 0
                      ? `↓ ${fmtPct(Math.abs(desconto30d))}`
                      : `↑ ${fmtPct(Math.abs(desconto30d))}`}
                  </span>
                )}
              </div>
            )}

            {/* CTA */}
            {(() => {
              const alertProps = {
                recordId:  disco.id,
                titulo:    disco.titulo,
                artista:   disco.artista,
                precoAtual,
                imgUrl:    disco.imgUrl,
              };

              const lojaComPrep = disco.marketplace === "mercadolivre" ? "no Mercado Livre" : "na Amazon";

              return disponivel ? (
                <>
                  <a
                    href={affiliateUrl(disco.url, disco.marketplace)}
                    target="_blank"
                    rel="sponsored noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-gold hover:bg-goldlit text-record font-bold text-sm py-4 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 focus-visible:ring-offset-2 focus-visible:ring-offset-record"
                  >
                    Ver {lojaComPrep}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </a>
                  <div className="flex items-center justify-between mt-2 px-1">
                    <p className="text-dust text-xs">Preços podem variar · <span className="text-dust/60">#anúncio</span></p>
                    <CopyLinkButton />
                  </div>
                  <AlertaTrigger {...alertProps} />
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-center bg-groove text-dust font-bold text-sm py-4 rounded-xl cursor-not-allowed border border-wax/50">
                    Indisponível {lojaComPrep}
                  </div>
                  {dataAtual && (
                    <p className="text-xs text-dust pl-1">Último registro em {dataAtual ? <time dateTime={dataAtual.toISOString()}>{dataAtualLabel}</time> : dataAtualLabel}</p>
                  )}
                  <AlertaTrigger {...alertProps} variant="primary" label="Avise-me quando voltar" />
                  <div className="flex justify-end">
                    <CopyLinkButton />
                  </div>
                </div>
              );
            })()}

            {/* Stats bar — suppressed when HIDE_PRICE_HISTORY */}
            {!HIDE_PRICE_HISTORY && (
              <dl className="flex items-stretch bg-sleeve rounded-xl border border-groove mt-3 overflow-hidden">
                <div className="flex-1 px-3 py-3 min-w-0">
                  <dt className="text-[9px] text-dust uppercase tracking-wide mb-1">Atual</dt>
                  <dd className="font-bold text-gold tabular-nums text-xs sm:text-sm">{fmt(precoAtual)}</dd>
                  <dd className="text-[9px] text-dust mt-0.5 truncate">{dataAtual ? <time dateTime={dataAtual.toISOString()}>{dataAtualLabel}</time> : dataAtualLabel}</dd>
                </div>
                <div className="w-px bg-groove self-stretch" aria-hidden="true" />
                <div className="flex-1 px-3 py-3 min-w-0">
                  <dt className="text-[9px] text-dust uppercase tracking-wide mb-1 flex items-center gap-0.5">
                    Mín. <span className="text-deallit">↓</span>
                  </dt>
                  <dd className="font-bold text-deallit tabular-nums text-xs sm:text-sm">{fmt(precoMin)}</dd>
                  {minRecord && <dd className="text-[9px] text-dust mt-0.5"><time dateTime={minRecord.capturadoEm.toISOString()}>{fmtDate(minRecord.capturadoEm)}</time></dd>}
                </div>
                <div className="w-px bg-groove self-stretch" aria-hidden="true" />
                <div className="flex-1 px-3 py-3 min-w-0">
                  <dt className="text-[9px] text-dust uppercase tracking-wide mb-1 flex items-center gap-0.5">
                    Máx. <span className="text-cut">↑</span>
                  </dt>
                  <dd className="font-bold text-cut tabular-nums text-xs sm:text-sm">{fmt(precoMax)}</dd>
                  {maxRecord && <dd className="text-[9px] text-dust mt-0.5"><time dateTime={maxRecord.capturadoEm.toISOString()}>{fmtDate(maxRecord.capturadoEm)}</time></dd>}
                </div>
              </dl>
            )}
          </div>
        </div>
      </header>

      {(() => {
        const sobreSection = (() => {
          // Section is independent of Last.fm now: show it if there's anything
          // worth showing — listener stats (>0), wiki, MB facts, or Amazon rating.
          const hasLastfm = albumInfo != null && albumInfo.listeners > 0;
          const wikiSummary = albumInfo?.wikiSummary ?? null;
          // sobrePt is Claude-written (claude_disco_bio_helper.py), only populated
          // where lastfm_wiki_pt was null — the two never coexist, so this is a
          // fallback, not a merge.
          const sobrePt = !wikiSummary ? (meta?.sobrePt ?? null) : null;
          const sobrePtSourceUrl = sobrePt ? (meta?.sobrePtSourceUrl ?? null) : null;
          const hasMb = mbInfo != null && Boolean(
            mbInfo.releaseYear || mbInfo.primaryType ||
            mbInfo.genres.length > 0 || mbInfo.tracklist.length > 0 || mbInfo.rating
          );
          const hasAmazon = Boolean(rating && disco.reviewCount && disco.reviewCount > 0);
          if (!hasLastfm && !wikiSummary && !sobrePt && !hasMb && !hasAmazon) return undefined;

          const cleanTitle = cleanAlbumTitle(disco.titulo, disco.artista);
          const lastfmUrl = `https://www.last.fm/music/${encodeURIComponent(disco.artista)}/${encodeURIComponent(cleanTitle)}`;
          return (
            <section aria-labelledby="sobre-album-heading" className="space-y-4">
              <h2 id="sobre-album-heading" className="font-display text-base font-semibold text-cream">Sobre o álbum</h2>

              {(hasLastfm || blendedRating != null) && (
                <div
                  className={`grid gap-3 ${
                    hasLastfm && blendedRating != null ? "sm:grid-cols-2" : "grid-cols-1"
                  }`}
                >
                  {hasLastfm && albumInfo && (
                    <div className="bg-sleeve rounded-xl border border-groove p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[10px] font-bold text-dust uppercase tracking-wide">Popularidade</h3>
                        <a
                          href={lastfmUrl}
                          target="_blank"
                          rel="nofollow noopener noreferrer"
                          className="text-xs text-dust hover:text-parchment transition-colors"
                          aria-label={`Ver ${disco.titulo} no Last.fm`}
                        >
                          Dados: Last.fm ↗
                        </a>
                      </div>
                      {popularity && popularity.total >= 3 && (
                        <>
                          <p className="font-display font-black text-cream text-3xl leading-none">#{popularity.rank}</p>
                          <p className="text-xs text-dust mt-1 mb-3">
                            {popularity.rank === 1 ? "disco mais ouvido" : "mais ouvido"} de{" "}
                            <Link
                              href={`/artista/${slugifyArtist(disco.artista)}`}
                              className="text-parchment hover:text-cream underline decoration-dotted decoration-dust/40 underline-offset-2 transition-colors"
                            >
                              {disco.artista}
                            </Link>
                          </p>
                        </>
                      )}
                      <p className="text-sm text-parchment leading-relaxed">
                        <span className="text-cream font-bold tabular-nums">{fmtCount(albumInfo.listeners)}</span> ouvintes
                        {" · "}
                        <span className="text-cream font-bold tabular-nums">{fmtCount(albumInfo.playcount)}</span> execuções
                      </p>
                    </div>
                  )}
                  {blendedRating != null && (
                    <div className="bg-sleeve rounded-xl border border-groove p-4">
                      <h3 className="text-[10px] font-bold text-dust uppercase tracking-wide mb-2">
                        {ratingParts.length >= 2 ? "Avaliação combinada" : "Avaliação"}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="font-display font-black text-cream text-3xl leading-none tabular-nums">
                          {blendedRating.toFixed(1).replace(".", ",")}
                        </span>
                        <div>
                          <div className="flex items-center gap-0.5" role="img" aria-label={`${blendedRating.toFixed(1)} de 5`}>
                            {Array.from({ length: 5 }, (_, i) => (
                              <svg
                                key={i}
                                className={`w-3.5 h-3.5 ${i < Math.round(blendedRating) ? "fill-gold text-gold" : "fill-none text-groove"}`}
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                aria-hidden="true"
                              >
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                              </svg>
                            ))}
                          </div>
                          <p className="text-xs text-dust mt-0.5">
                            {ratingParts.length >= 2
                              ? `média ponderada de ${totalVotes} votos`
                              : `${totalVotes.toLocaleString("pt-BR")} ${
                                  ratingParts[0].label === "Amazon" ? "avaliações" : "votos"
                                } · ${ratingParts[0].label}`}
                          </p>
                        </div>
                      </div>
                      {ratingParts.length >= 2 && (
                        <div className="flex gap-2 mt-3">
                          {ratingParts.map((pt) => (
                            <div key={pt.label} className="flex-1 border border-groove rounded-lg px-3 py-2">
                              <p className="font-bold text-cream tabular-nums">{pt.value.toFixed(1).replace(".", ",")}</p>
                              <p className="text-[10px] text-dust uppercase tracking-wide">
                                {pt.label} · {pt.count}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {wikiSummary && (
                <div className="bg-sleeve rounded-xl border border-groove p-4">
                  <WikiExpander text={wikiSummary} />
                  <div className="mt-3 text-right">
                    <a
                      href={lastfmUrl}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="text-xs text-dust hover:text-parchment transition-colors"
                      aria-label={`Ver ${disco.titulo} no Last.fm`}
                    >
                      Dados: Last.fm ↗
                    </a>
                  </div>
                </div>
              )}

              {sobrePt && (
                <div className="bg-sleeve rounded-xl border border-groove p-4">
                  <WikiExpander text={sobrePt} />
                  {sobrePtSourceUrl && (
                    <div className="mt-3 text-right">
                      <a
                        href={sobrePtSourceUrl}
                        target="_blank"
                        rel="nofollow noopener noreferrer"
                        className="text-xs text-dust hover:text-parchment transition-colors"
                        aria-label={`Ver ${disco.titulo} na Wikipedia`}
                      >
                        Dados: Wikipedia ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {hasMb && mbInfo && (
                <div className="bg-sleeve rounded-xl border border-groove p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-dust uppercase tracking-wide">Ficha técnica</h3>
                    <a
                      href={mbInfo.url}
                      target="_blank"
                      rel="nofollow noopener noreferrer"
                      className="text-xs text-dust hover:text-parchment transition-colors flex items-center gap-1"
                      aria-label={`Ver ${disco.titulo} no MusicBrainz`}
                    >
                      Dados: MusicBrainz ↗
                    </a>
                  </div>
                  <dl className="space-y-2 text-sm">
                    {mbInfo.releaseYear && (
                      <div className="flex justify-between">
                        <dt className="text-dust">Lançamento</dt>
                        <dd className="text-cream font-medium">
                          <time dateTime={mbInfo.releaseYear}>
                          {(() => {
                            const year = parseInt(mbInfo.releaseYear, 10);
                            const decade = Math.floor(year / 10) * 10;
                            return year && decade >= 1960 && decade <= 2020 ? (
                              <Link
                                href={`/decada/${decade}`}
                                className="text-gold underline decoration-dotted decoration-gold/40 underline-offset-2 hover:decoration-gold transition-colors"
                              >
                                {mbInfo.releaseYear}
                              </Link>
                            ) : (
                              mbInfo.releaseYear
                            );
                          })()}
                          </time>
                        </dd>
                      </div>
                    )}
                    {mbInfo.primaryType && (
                      <div className="flex justify-between">
                        <dt className="text-dust">Tipo</dt>
                        <dd className="text-cream font-medium">{mbInfo.primaryType}</dd>
                      </div>
                    )}
                    {artistPais && (
                      <div className="flex justify-between">
                        <dt className="text-dust">Origem</dt>
                        <dd className="text-cream font-medium">
                          <Link
                            href={`/pais/${artistPais.slug}`}
                            className="text-gold underline decoration-dotted decoration-gold/40 underline-offset-2 hover:decoration-gold transition-colors"
                          >
                            {artistPais.nome}
                          </Link>
                        </dd>
                      </div>
                    )}
                    {mbInfo.genres.length > 0 && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-dust">Gêneros</dt>
                        <dd className="text-cream font-medium text-right capitalize">
                          {mbInfo.genres.map((g, i) => (
                            <span key={g.name}>
                              {i > 0 && ", "}
                              {g.slug ? (
                                <Link
                                  href={`/estilo/${g.slug}`}
                                  className="text-gold underline decoration-dotted decoration-gold/40 underline-offset-2 hover:decoration-gold transition-colors"
                                >
                                  {g.name}
                                </Link>
                              ) : (
                                g.name
                              )}
                            </span>
                          ))}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {mbInfo.tracklist.length > 0 && <Tracklist tracks={mbInfo.tracklist} />}
                </div>
              )}

            </section>
          );
        })();

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
        <section aria-labelledby="faq-heading" className="mt-6 bg-sleeve rounded-xl border border-groove p-4">
          <h2 id="faq-heading" className="font-display text-2xl font-black text-cream italic mb-3">
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

      </article>

      {/* More from this artist */}
      {processedArtistAlbums.length > 0 && (
        <aside aria-labelledby="mais-artista-heading" className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="mais-artista-heading" className="font-display text-2xl font-black text-cream italic">
              Mais de {disco.artista}
            </h2>
            <Link
              href={`/artista/${slugifyArtist(disco.artista)}`}
              className="text-[11px] font-bold uppercase tracking-widest text-dust hover:text-gold transition-colors"
            >
              Ver Todos
            </Link>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {processedArtistAlbums.map((album) => (
              <li key={album.id}>
                <DiscoCard disco={album} />
              </li>
            ))}
          </ul>
        </aside>
      )}

      {/* Related deals */}
      {processedDeals.length > 0 && (
        <aside aria-labelledby="outros-discos-heading" className="mt-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 id="outros-discos-heading" className="font-display text-2xl font-black text-cream italic">
              Outros discos em oferta
            </h2>
            <Link
              href="/disco"
              className="text-[11px] font-bold uppercase tracking-widest text-dust hover:text-gold transition-colors"
            >
              Ver Todos
            </Link>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {processedDeals.map((deal) => (
              <li key={deal.id}>
                <DiscoCard disco={deal} />
              </li>
            ))}
          </ul>
        </aside>
      )}

      <GuiasRelacionados className="mt-10 pt-6 border-t border-groove" />

      <BackToTop />
    </div>
    </>
  );
}
