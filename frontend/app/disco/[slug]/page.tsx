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
import { formatoVinilPt } from "@/lib/formatoVinil";
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
// Kept deliberately small: at 3000/1000/500 the build spent 7.2min prerendering
// 4600 pages and exhausted Supabase's pooler (EMAXCONN, limit 400) on
// concurrent builds. The top slugs are the ones bots re-hit constantly, so a
// short head captures most of the benefit; the tail still renders on demand.
export async function generateStaticParams() {
  return (await getTopBotHitSlugs("/disco/", 300)).map((slug) => ({ slug }));
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
  const meta = await getDiscoMeta(slug).catch(() => null);

  const tituloLimpo = cleanAlbumTitle(disco.titulo, disco.artista) || disco.titulo;
  const isUnknownArtistDisco = disco.artista.toLowerCase() === "artista não identificado";
  const includeArtist = !isUnknownArtistDisco && !tituloLimpo.toLowerCase().includes(disco.artista.toLowerCase());
  const base = includeArtist ? `${tituloLimpo} em Vinil — ${disco.artista}` : `${tituloLimpo} em Vinil`;
  let title = `${base} | Garimpa Vinil`;
  if (title.length > 60) title = base;
  if (title.length > 60 && includeArtist) title = `${tituloLimpo} em Vinil`;
  if (title.length > 60) title = `${truncateTitle(tituloLimpo, 51)} em Vinil`;

  // mb_first_release_date is the release-GROUP date, i.e. the album's ORIGINAL
  // year — not the year this particular pressing was manufactured, which we
  // don't know. Rendered parenthetically after the album title so it reads as
  // the album's year rather than implying a pressing date. Applied last and
  // only when it still fits the 60-char budget, so it never costs the artist
  // name or the brand suffix; skipped entirely on the truncated variant.
  const anoOriginal = /^(\d{4})/.exec(meta?.mbFirstReleaseDate ?? "")?.[1];
  if (anoOriginal && title.includes(tituloLimpo)) {
    const comAno = title.replace(tituloLimpo, `${tituloLimpo} (${anoOriginal})`);
    if (comAno.length <= 60) title = comAno;
  }

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
  const [estilosList, relatedDeals, popularity, artistAlbums] = await Promise.all([
    // Genres link to /estilo/[slug] only when a style page actually exists for
    // that slug (style pages are derived from lastfm_tags, not MB genres).
    meta?.mbMbid ? getEstilosList() : Promise.resolve([]),
    getRelatedDeals(disco.id, slug, styleTags),
    // Rank of this album among the artist's tracked vinyls, by Last.fm listeners.
    (meta?.lastfmListeners ?? 0) > 0
      ? getArtistPopularity(disco.artista, slug)
      : Promise.resolve(null),
    // Other vinyls by the same artist (most-listened first) for a dedicated rail.
    artistLower === "artista não identificado"
      ? Promise.resolve([])
      : getArtistTopAlbums(disco.artista, disco.id, slug),
  ]);

  // MusicBrainz release-group facts (mb_mbid = "" means searched, no match).
  const validStyleSlugs = new Set(estilosList.map((e) => e.slug));
  // "Single" is frequently a wrong release-group match — hide it rather than
  // surface a likely-mislabeled type. Localize the rest to pt-BR.
  const MB_TYPE_PT: Record<string, string> = { Album: "Álbum", EP: "EP", Compilation: "Coletânea" };
  // Vinyl tracklist from the exact pressing Discogs resolved by barcode.
  // Preferred over mb_tracklist, which comes from the release GROUP's
  // representative release and is frequently the CD: sampling 59 records,
  // 15 disagreed by more than two tracks, e.g. Castle in the Sky at 23 tracks
  // on MusicBrainz versus 14 on the actual LP. It also carries side positions,
  // which MusicBrainz has no concept of at group level.
  const discogsTracks = ((): { title: string; length: number | null; position: string | null }[] => {
    const raw = meta?.discogsTracklist;
    if (!Array.isArray(raw)) return [];
    return raw
      // Rows already stored before the crawler learned to drop Discogs
      // "heading" dividers: they carry a title but no position, and left in
      // they inflate the count and break side detection.
      .filter((t): t is { title: string; position?: string; duration?: string } =>
        Boolean(t && typeof t === "object" && "title" in t))
      .filter((t) => String(t.position ?? "").trim() !== "")
      .map((t) => ({
        title: String(t.title),
        // Discogs durations are "3:42" strings; the component wants ms.
        length: (() => {
          const m = /^(\d+):(\d{2})$/.exec(String(t.duration ?? "").trim());
          return m ? (Number(m[1]) * 60 + Number(m[2])) * 1000 : null;
        })(),
        position: t.position ? String(t.position) : null,
      }));
  })();

  // Original release year. MusicBrainz sometimes matched a reissue
  // release-group, and Discogs' master is sometimes itself a reissue master —
  // in both cases the wrong value is the LATER one, so the earlier of the two
  // is the album's original year. Measured on 59 records: 7 disagreed, and
  // taking the minimum was correct in every case checked (Castle in the Sky
  // MB 2002 / Discogs 1986; Selena LIVE MB 2026 / Discogs 1993).
  const mbYear = Number(meta?.mbFirstReleaseDate?.slice(0, 4)) || null;
  const dgYear = meta?.discogsMasterYear ?? null;
  const originalYear =
    mbYear && dgYear ? String(Math.min(mbYear, dgYear)) : String(mbYear ?? dgYear ?? "") || null;

  // Built from whichever source has anything to say. It was gated on a
  // MusicBrainz match, which hid the entire panel — tracklist included — on
  // 1,170 records that Discogs resolved and MusicBrainz never matched. Their
  // sides and original year were collected and then never rendered.
  // The year this copy was pressed, as opposed to when the album came out.
  // Rendered inline with Lançamento rather than as its own row: two bare dates
  // in a list never explain how they relate, and "2024-05-03" was both
  // over-precise (nobody chooses by the day) and the wrong date format for a
  // Portuguese page. discogs_released is a full date on 8,439 records and a
  // bare year on 2,129, so taking the first four characters is also what makes
  // it render consistently.
  //
  // Only shown when it differs from the album year — on 4,316 records they are
  // the same and repeating it says nothing. 15 records claim a pressing BEFORE
  // the album, which is impossible and is dropped as bad data.
  const pressingYear = (() => {
    const y = Number((meta?.discogsReleased ?? "").slice(0, 4));
    if (!y || !originalYear) return null;
    const album = Number(originalYear);
    return y > album ? String(y) : null;
  })();

  const mbInfo = (meta?.mbMbid || discogsTracks.length > 0 || dgYear)
    ? {
        releaseYear: originalYear,
        primaryType: meta?.mbPrimaryType ? MB_TYPE_PT[meta.mbPrimaryType] ?? null : null,
        genres: (meta?.mbGenres ?? "")
          .split(", ")
          .filter(Boolean)
          .slice(0, 3)
          .map((name) => {
            const slug = slugifyStyle(name);
            return { name, slug: validStyleSlugs.has(slug) ? slug : null };
          }),
        // Community rating (0–5). Hide low-vote noise — needs >=10 votes.
        rating:
          meta?.mbRating != null && (meta.mbRatingVotes ?? 0) >= 10
            ? { value: meta.mbRating, votes: meta.mbRatingVotes as number }
            : null,
        // Discogs (the actual vinyl) wins; MusicBrainz is the fallback for
        // records Discogs has not resolved.
        tracklist: discogsTracks.length
          ? discogsTracks
          : ((): { title: string; length: number | null }[] => {
              try {
                const parsed = JSON.parse(meta?.mbTracklist ?? "[]");
                if (!Array.isArray(parsed)) return [];
                // New format: [{title, length}]. Legacy format: [string].
                return parsed.map((t) =>
                  typeof t === "string" ? { title: t, length: null } : t
                );
              } catch {
                return [];
              }
            })(),
        url: meta?.mbMbid
          ? `https://musicbrainz.org/release-group/${meta.mbMbid}`
          : null,
        // Attribution has to name the sources this record actually used. The
        // panel credited MusicBrainz alone while showing a Discogs tracklist
        // and, where the two disagreed, a Discogs release year. Discogs' API
        // terms require attribution when their data is displayed.
        sources: [
          ...(meta?.mbMbid
            ? [{
                name: "MusicBrainz",
                url: `https://musicbrainz.org/release-group/${meta.mbMbid}`,
              }]
            : []),
          ...(meta?.discogsReleaseId
            ? [{
                name: "Discogs",
                url: `https://www.discogs.com/release/${meta.discogsReleaseId}`,
              }]
            : discogsTracks.length > 0 || dgYear
              ? [{ name: "Discogs", url: null }]
              : []),
        ],
      }
    : null;

  // The header badge and "Ficha técnica" must show the same genres — they
  // used to disagree because the header read raw lastfm_tags (which a past
  // enrichment bug clobbered to the ARTIST's tags on many rows, e.g. every
  // Pantera album showing "thrash metal, groove metal, heavy metal" even
  // when it doesn't apply to that specific record) while Ficha técnica
  // already read the per-release mb_genres. Prefer mbInfo.genres (same
  // validated {name, slug} shape Ficha técnica uses) and only fall back to
  // lastfm-derived styleTags when there's no MB genre data at all.
  const headerGenres = mbInfo && mbInfo.genres.length > 0
    ? mbInfo.genres
    : styleTags.map((tag) => {
        const tagSlug = slugifyStyle(tag);
        return { name: tag, slug: validStyleSlugs.has(tagSlug) ? tagSlug : null };
      });

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
    // Discogs clears the 10-vote bar far more often than MusicBrainz does: on a
    // 12-release sample, 8 versus the 1,739 records site-wide that qualify on
    // MusicBrainz. Same 5-point scale, so it blends without conversion.
    ...(meta?.discogsRating && (meta.discogsRatingVotes ?? 0) >= 10
      ? [{ label: "Discogs", value: Number(meta.discogsRating), count: meta.discogsRatingVotes as number }]
      : []),
  ];
  const totalVotes = ratingParts.reduce((n, r) => n + r.count, 0);
  const blendedRating =
    totalVotes > 0
      ? ratingParts.reduce((n, r) => n + r.value * r.count, 0) / totalVotes
      : null;
  // ratingCount (not reviewCount): the aggregate mixes Amazon buyer reviews
  // with MusicBrainz and Discogs community ratings, so "ratings" is the
  // accurate umbrella term. All three are 5-point scales.
  //
  // Google requires an aggregateRating in Product markup to be visible on the
  // page, and it is: the "Avaliação combinada" block below renders this same
  // number, the same vote total, and now names the sources it came from.
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
    // Barcode from Amazon's Creators API (itemInfo.externalIds). This is the
    // identifier Google uses to match a listing to a real-world product, so it
    // is worth more than sku/brand alone. Guarded on exactly 13 digits: a
    // malformed gtin13 is worse than none, since it would assert this listing
    // IS some other product.
    ...(meta?.ean && /^\d{13}$/.test(meta.ean) ? { gtin13: meta.ean } : {}),
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

  // schema.org distinguishes what the release IS (albumReleaseType) from how it
  // was produced (albumProductionType). Discogs states both in its format
  // descriptors — measured across the catalogue: 7,649 Album, 1,028
  // Compilation, 347 EP, 213 Single.
  //
  // Only the two that are unambiguous are emitted. "Album" alone does not
  // distinguish a studio album from a live one, and guessing StudioAlbum would
  // assert something we did not measure.
  const albumTypeLd = ((): Record<string, string> => {
    const terms = new Set(
      (meta?.discogsFormatDesc ?? "").split(",").map((t) => t.trim()),
    );
    if (terms.has("Compilation")) {
      return {
        albumReleaseType: "https://schema.org/AlbumRelease",
        albumProductionType: "https://schema.org/CompilationAlbum",
      };
    }
    if (terms.has("EP") || terms.has("Mini-Album")) {
      return { albumReleaseType: "https://schema.org/EPRelease" };
    }
    if (terms.has("Single") || terms.has("Maxi-Single")) {
      return { albumReleaseType: "https://schema.org/SingleRelease" };
    }
    if (terms.has("Album")) {
      return { albumReleaseType: "https://schema.org/AlbumRelease" };
    }
    return {};
  })();

  const musicAlbumJsonLd = toJsonLd({
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    "@id": `${siteUrl}/disco/${slug}#album`,
    name: disco.titulo,
    url: `${siteUrl}/disco/${slug}`,
    ...(disco.imgUrl ? { image: disco.imgUrl } : {}),
    // @id points at the MusicGroup the artist page already publishes, which
    // carries sameAs to Wikidata, Spotify and MusicBrainz. Without it the two
    // are separate nodes and none of that identity reaches the record.
    byArtist: {
      "@type": "MusicGroup",
      "@id": `${siteUrl}/artista/${slugifyArtist(disco.artista)}#musicgroup`,
      name: disco.artista,
      url: `${siteUrl}/artista/${slugifyArtist(disco.artista)}`,
    },
    ...(meta?.mbFirstReleaseDate ? { datePublished: meta.mbFirstReleaseDate } : {}),
    ...(albumGenres.length ? { genre: albumGenres } : {}),
    // Declare the physical format. schema.org/VinylFormat is the precise term
    // and this catalogue is vinyl-only (non-vinyl rows carry format='cd' or
    // 'other' and never reach this page), so it's always accurate here. Without
    // it nothing in the markup states that these products are records at all.
    musicReleaseFormat: "https://schema.org/VinylFormat",
    ...albumTypeLd,
    // Label only. Catalogue number and pressing country are deliberately NOT
    // emitted even though the crawler stores them:
    //   * They come from the single-release case, and for a much-reissued album
    //     "MusicBrainz has one release" means MB's coverage is thin, not that
    //     one pressing exists — Queen "Greatest Hits" resolves to a Russian
    //     Hollywood Records pressing that Amazon Brasil plainly is not selling.
    //   * mb_release_country is 41% XW/XE, which are MusicBrainz pseudo-codes
    //     for Worldwide/Europe, not countries, and the rest are ISO codes
    //     rather than names.
    // A label survives across pressings far better than a catalogue number, and
    // most stored labels come from the safer case (every release sharing one
    // label). Asserting the wrong catalogue number tells Google this listing is
    // a different physical product.
    // Prefers the Discogs label, exactly as the visible Gravadora row does.
    // Reading mb_label alone published an empty recordLabel on 10,062 records
    // that show a label on screen — Discogs has one where MusicBrainz does not.
    ...((meta?.discogsLabel || meta?.mbLabel)
      ? {
          recordLabel: {
            "@type": "Organization",
            name: meta?.discogsLabel ?? meta?.mbLabel,
          },
        }
      : {}),
    // Safe to assert now: it comes from a barcode-resolved pressing, and is
    // only stored when the barcode mapped to a single Discogs release.
    ...(meta?.discogsCatno ? { catalogNumber: meta.discogsCatno } : {}),
    ...(mbInfo && mbInfo.tracklist.length
      ? {
          numTracks: mbInfo.tracklist.length,
          track: mbInfo.tracklist.map((t, i) => ({
            "@type": "MusicRecording",
            "@id": `${siteUrl}/disco/${slug}#track-${i + 1}`,
            name: t.title,
            ...(t.length ? { duration: msToIso(t.length) } : {}),
            // The vinyl side, where Discogs gave one: "A1", "B2". Ordinal
            // position on its own is implied by array order, so the useful
            // thing to state is which side of which disc the track is on.
            ...(("position" in t && t.position)
              ? { position: String(t.position) }
              : {}),
          })),
        }
      : {}),
    ...(aggregateRatingLd ? { aggregateRating: aggregateRatingLd } : {}),
    // Entity-linking to the canonical record on each source -- only where we
    // hold a verified URL/ID, never a guessed slug (a wrong sameAs is worse
    // than no sameAs). No Last.fm entry: we only store tags/wiki text for
    // this record, not a canonical last.fm/music/... URL, and that URL's
    // slug isn't reliably derivable from artista/titulo.
    ...((meta?.sobrePtSourceUrl || meta?.mbMbid || meta?.discogsReleaseId)
      ? {
          sameAs: [
            ...(meta?.sobrePtSourceUrl ? [meta.sobrePtSourceUrl] : []),
            // mb_mbid is '' (not null) when a search ran and found no match --
            // only build the URL when there's an actual ID.
            ...(meta?.mbMbid ? [`https://musicbrainz.org/release-group/${meta.mbMbid}`] : []),
            // The Discogs release, which unlike a MusicBrainz release-GROUP
            // identifies the exact pressing this listing sells. Only set when
            // a barcode resolved it, so it is never a guess.
            ...(meta?.discogsReleaseId
              ? [`https://www.discogs.com/release/${meta.discogsReleaseId}`]
              : []),
          ],
        }
      : {}),
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

        {/* The sleeve column renders even without a cover. 133 listable records
            have no image — Amazon serves a 60x40 blank for them and genuinely
            has no art — and dropping the column made the hero collapse to one
            full-width slab of text that reads as a broken page. DiscoCard
            already draws this mark in the same situation; the detail page was
            the only surface that showed nothing. */}
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-[82px]">
            {/* Offset shadow layer — stacked sleeve effect */}
            <div className="relative">
              <div className="absolute inset-0 translate-x-3 translate-y-3 bg-groove border border-wax/40 rounded-2xl" aria-hidden="true" />
              <div className="relative aspect-square bg-label rounded-2xl overflow-hidden">
                {disco.imgUrl ? (
                  <Image
                    src={disco.imgUrl}
                    alt={`${disco.titulo} por ${disco.artista}, capa do álbum`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 480px"
                    className="object-cover"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <svg viewBox="0 0 48 48" fill="none" className="w-16 h-16 text-patina" aria-hidden="true">
                      <path d="M18 34V16l18-4v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="14" cy="34" r="4" stroke="currentColor" strokeWidth="2" />
                      <circle cx="32" cy="30" r="4" stroke="currentColor" strokeWidth="2" />
                    </svg>
                    <p className="text-dust text-xs leading-relaxed">
                      Capa não disponível para este disco
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-between lg:col-span-7">
          <div>
            {/* Single meta line: artist · genre */}
            <p className="text-dust text-[11px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2 flex-wrap">
              <Link
                href={`/artista/${slugifyArtist(disco.artista)}`}
                className="hover:text-parchment transition-colors"
              >
                {disco.artista}
              </Link>
              {headerGenres.length > 0 && (
                <>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  {headerGenres.map((g, i) => (
                    <span key={g.name} className="contents">
                      {i > 0 && <span aria-hidden="true" className="opacity-40">/</span>}
                      {g.slug ? (
                        <Link
                          href={`/estilo/${g.slug}`}
                          className="hover:text-parchment transition-colors"
                        >
                          {g.name}
                        </Link>
                      ) : (
                        g.name
                      )}
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
                    desconto30d >= 1 ? "text-deallit" : "text-cutlit"
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
                    Máx. <span className="text-cutlit">↑</span>
                  </dt>
                  <dd className="font-bold text-cutlit tabular-nums text-xs sm:text-sm">{fmt(precoMax)}</dd>
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
          // Last.fm canonicalises spaces as "+", not "%20" — album.getInfo
          // returns e.g. https://www.last.fm/music/Larkin+Poe/Reskinned. The
          // %20 form usually redirects but isn't the canonical URL, so encode
          // everything else normally and then swap %20 for +.
          const lastfmSegment = (s: string) => encodeURIComponent(s).replace(/%20/g, "+");
          // MusicBrainz publishes a canonical Last.fm artist URL, which fixes
          // cases our own artista string gets wrong -- most importantly "AC/DC",
          // where the raw slash builds a broken path and MB has "AC%2FDC".
          //
          // But MB's first last.fm relation is not always the one to use: for
          // Taylor Swift it's the Japanese-language page, and for Travis Scott
          // the "Travi$ Scott" alias. So adopt it only when it is the SAME name
          // as ours once case, punctuation and accents are folded away -- i.e.
          // when the only thing we gain is correct encoding or accenting
          // ("Maria Bethânia", "Panic! at the Disco"). A genuinely different
          // string means we can't tell which is right, so keep our own.
          const foldName = (s: string) =>
            s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
          const canonicalBase = (() => {
            const raw = meta?.artistLastfmUrl;
            if (!raw) return null;
            const seg = raw.replace(/\/+$/, "").split("/music/")[1];
            if (!seg) return null;
            let decoded: string;
            try {
              decoded = decodeURIComponent(seg.replace(/\+/g, " "));
            } catch {
              return null; // malformed percent-encoding stored upstream
            }
            return foldName(decoded) === foldName(disco.artista)
              ? raw.replace(/%20/g, "+").replace(/\/+$/, "")
              : null;
          })();
          const artistBase =
            canonicalBase ?? `https://www.last.fm/music/${lastfmSegment(disco.artista)}`;
          const lastfmUrl = `${artistBase}/${lastfmSegment(cleanTitle)}`;
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
                              ? `${totalVotes.toLocaleString("pt-BR")} votos · ${ratingParts
                                  .map((r) => r.label)
                                  .join(", ")}`
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
                    <p className="text-xs text-dust flex items-center gap-1 flex-wrap justify-end">
                      <span>Dados:</span>
                      {mbInfo.sources.map((src, i) => (
                        <span key={src.name} className="flex items-center gap-1">
                          {i > 0 && <span aria-hidden="true">·</span>}
                          {src.url ? (
                            <a
                              href={src.url}
                              target="_blank"
                              rel="nofollow noopener noreferrer"
                              className="hover:text-parchment transition-colors"
                              aria-label={`Ver ${disco.titulo} no ${src.name}`}
                            >
                              {src.name} ↗
                            </a>
                          ) : (
                            src.name
                          )}
                        </span>
                      ))}
                    </p>
                  </div>
                  <dl className="space-y-2 text-sm">
                    {/* Discogs describes the physical record; MusicBrainz
                        describes the release-group it matched, which is often
                        the wrong one. Jethro Tull "Living In The Past" is a
                        21-track double compilation and MusicBrainz called it an
                        EP. Same class of error as the release year, which the
                        Discogs master already overrides. */}
                    {(formatoVinilPt(meta?.discogsFormatDesc) || mbInfo.primaryType) && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-dust">Formato</dt>
                        <dd className="text-cream font-medium text-right">
                          {formatoVinilPt(meta?.discogsFormatDesc) ?? mbInfo.primaryType}
                        </dd>
                      </div>
                    )}
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
                          {pressingYear && (
                            <span className="text-dust font-normal">
                              {" · esta prensagem "}
                              <time dateTime={pressingYear}>{pressingYear}</time>
                            </span>
                          )}
                        </dd>
                      </div>
                    )}
                    {/* Pressing-level rows. Absent on ~57% of records on
                        purpose: only stored when the MusicBrainz release-group
                        is unambiguous, because a release-group spans every
                        pressing of an album (Genesis "Foxtrot" covers 38 across
                        11 labels) and we only matched at group level. */}
                    {/* Discogs names the label on this pressing; MusicBrainz
                        names one for the release-group. Discogs had a label
                        where MusicBrainz had none on 21 of 29 sampled. */}
                    {(meta?.discogsLabel || meta?.mbLabel) && (
                      <div className="flex justify-between gap-4">
                        <dt className="text-dust">Gravadora</dt>
                        <dd className="text-cream font-medium text-right">
                          {meta?.discogsLabel ?? meta?.mbLabel}
                        </dd>
                      </div>
                    )}
                    {/* No "Prensado em" row. 41% of discogs_country is a region
                        or a shrug rather than a country — Europe (83),
                        Worldwide (46), Unknown (12), USA & Europe (10) — which
                        is the same objection that kept MusicBrainz's XW/XE off
                        the page, just spelled out. And no "Catálogo" row: the
                        number is correct but it is collector minutiae that does
                        not help someone decide whether to buy. It still goes out
                        as schema.org catalogNumber, where it helps Google
                        identify the product without taking up space here. */}
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
