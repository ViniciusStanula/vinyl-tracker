import { memo } from "react";
import Image from "next/image";
import Link from "next/link";
import { artistaHref } from "@/lib/utils/slugify";
import { affiliateUrl } from "@/lib/affiliateUrl";
import { resizeAmazonImage } from "@/lib/utils/amazonImage";

// NEXT_PUBLIC_HIDE_PRICE_HISTORY gates sparklines, deal badges, discount badges, and
// struck-through avg prices on cards. Defaults to hidden (true) — fail-safe while
// Amazon is the only price source (Associates Operating Agreement prohibits displaying
// monitored price history). Set to "false" in env to re-enable, e.g. when Mercado
// Livre is added and per-retailer gating replaces this global flag.
const HIDE_PRICE_HISTORY = process.env.NEXT_PUBLIC_HIDE_PRICE_HISTORY !== "false";

export interface DiscoCardProps {
  id: string;
  slug: string;
  titulo: string;
  /** SEO-clean title (crawler/titulo_seo.py) -- preferred over `titulo` for
   * display when present. Optional so callers that haven't been updated to
   * select it yet still render correctly with the raw título. */
  tituloSeo?: string | null;
  artista: string;
  estilo?: string | null;
  imgUrl: string | null;
  url: string;
  /** Price/link source: "amazon" or "mercadolivre" — drives buy-button label + affiliate tagging */
  marketplace: string;
  rating: number | null;
  precoAtual: number;
  mediaPreco: number;
  emPromocao?: boolean;
  desconto: number;
  sparkline?: number[];
  /** Scoring tier: 1 = Boa Oferta, 2 = Ótima Oferta, 3 = Melhor Preço, null = no deal */
  dealScore?: number | null;
  /** Backend confidence tier; "low_confidence" triggers a data-warning indicator */
  confidenceLevel?: string | null;
  /** Comma-separated Last.fm genre tags, e.g. "rock, classic rock" */
  lastfmTags?: string | null;
  /** When false, renders as greyed-out with Indisponível badge. Defaults to true. */
  disponivel?: boolean;
}

/** 44×18 px SVG sparkline showing the 30-day price trend. */
function Sparkline({ values, avg }: { values: number[]; avg: number }) {
  if (values.length < 2) return null;
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const mid = (dataMin + dataMax) / 2;
  const minRange = mid * 0.10;
  const min = Math.min(dataMin, mid - minRange / 2);
  const max = Math.max(dataMax, mid + minRange / 2);
  const range = max - min || 1;
  const W = 44, H = 18, PAD = 1;
  const pts = values
    .map((v, i) => {
      const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Green when current price is below historical average, red when above.
  const currentPrice = values[values.length - 1];
  const belowAvg = avg > 0 ? currentPrice < avg : currentPrice <= values[0];
  return (
    <svg width={W} height={H} aria-hidden="true" className="shrink-0 opacity-80">
      <polyline
        points={pts}
        fill="none"
        className={belowAvg ? "stroke-deallit" : "stroke-cut"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default memo(function DiscoCard({
  disco,
  priority = false,
}: {
  disco: DiscoCardProps;
  priority?: boolean;
}) {
  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });

  const isUnavailable     = disco.disponivel === false;
  const descontoPercent   = Math.round(disco.desconto * 100);
  const showOriginalPrice = descontoPercent > 0;
  const dealScore         = disco.dealScore ?? null;
  const artistaUrl        = artistaHref(disco.artista);
  const titulo            = disco.tituloSeo || disco.titulo;
  const sparkline         = disco.sparkline ?? [];
  // Cards render at ~160-230px; the DB stores 1500px Amazon URLs (~200KB).
  // SL416 covers 2x DPR at ~30KB via Amazon's on-the-fly CDN resize.
  const imgUrl            = resizeAmazonImage(disco.imgUrl);
  // Buy-link source: Amazon (default) or Mercado Livre. Drives label + tagging.
  const isML              = disco.marketplace === "mercadolivre";
  const lojaNome          = isML ? "Mercado Livre" : "Amazon";
  const lojaComPrep       = isML ? "no Mercado Livre" : "na Amazon";  // pt-BR preposition

  // Score-3 gets a subtle gold ring — suppressed when price history is hidden
  const cardRing = (!HIDE_PRICE_HISTORY && dealScore === 3) ? " ring-1 ring-gold/40" : "";

  const titleId = `disco-title-${disco.id}`;

  return (
    <article aria-labelledby={titleId} className={`relative group bg-sleeve rounded-xl overflow-hidden flex flex-col border border-groove hover:border-wax transition-colors duration-200${cardRing}${isUnavailable ? " opacity-60 grayscale" : ""}`}>
      {/* The card-wide click target lives on the title link's ::after (below),
          not on a bare overlay <a>. An overlay carries no anchor text, so every
          internal link to every /disco page was sending Google an empty anchor
          -- from the card grid, which is the site's main internal-link surface. */}

      {/* ── Album art ─────────────────────────────────────────────── */}
      <div className="relative aspect-square bg-label shrink-0 overflow-hidden">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={`${titulo} por ${disco.artista}, capa do álbum`}
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, (max-width: 1535px) 20vw, 17vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            priority={priority}
            loading={priority ? undefined : "lazy"}
            // Lazy (below-fold) covers skip Vercel optimization — the SL416
            // Amazon URL is already card-sized, so serve it direct ($0 quota).
            // Priority (LCP) covers stay optimized to protect Core Web Vitals.
            unoptimized={!priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 48 48" fill="none" className="w-12 h-12 text-patina opacity-60">
              <path d="M18 34V16l18-4v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="14" cy="34" r="4" stroke="currentColor" strokeWidth="2"/>
              <circle cx="32" cy="30" r="4" stroke="currentColor" strokeWidth="2"/>
            </svg>
          </div>
        )}

        {/* Subtle gradient overlay — bottom fade for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-record/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {isUnavailable ? (
          <div className="absolute bottom-2 left-2 z-20 inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-groove/90 text-parchment">
            Indisponível
          </div>
        ) : (
          <>
            {/* Deal tier badge — suppressed when HIDE_PRICE_HISTORY */}
            {!HIDE_PRICE_HISTORY && dealScore !== null && (
              <div className={`absolute bottom-2 left-2 z-20 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                dealScore === 3
                  ? "bg-gold/90 text-record"
                  : dealScore === 2
                  ? "bg-deal/90 text-cream"
                  : "bg-record/70 text-parchment backdrop-blur-sm"
              }`}>
                {dealScore === 3 && <span aria-hidden="true">✦</span>}
                {dealScore === 2 && <span aria-hidden="true">✓</span>}
                {dealScore === 3 ? "Melhor Preço" : dealScore === 2 ? "Ótima Oferta" : "Boa Oferta"}
              </div>
            )}

            {/* Discount badge — suppressed alongside deal badge (% has no reference without avg) */}
            {!HIDE_PRICE_HISTORY && descontoPercent > 0 && (
              <div className="absolute top-2 left-2 z-20 bg-cut text-cream text-xs font-black px-2.5 py-1 rounded-md shadow-lg shadow-cut/30 tabular-nums">
                -{descontoPercent}%
              </div>
            )}

            {/* Store quick-link — hover only */}
            <a
              href={affiliateUrl(disco.url, disco.marketplace)}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100 transition-opacity bg-record/80 text-cream text-xs font-medium px-2.5 py-1.5 rounded-md backdrop-blur-sm"
              aria-label={`Ver ${titulo} ${lojaComPrep}`}
            >
              {lojaNome} ↗
              <span className="block text-[9px] text-dust/70 leading-none mt-0.5">#anúncio</span>
            </a>
          </>
        )}
      </div>

      {/* ── Info ──────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col flex-1">

        {/* Artist — z-20 to sit above the title link's ::after click layer */}
        {artistaUrl ? (
          <Link
            href={artistaUrl}
            className="relative z-20 block text-parchment text-[10px] truncate font-bold uppercase tracking-widest hover:text-cream transition-colors"
          >
            {disco.artista}
          </Link>
        ) : (
          <span className="block text-parchment text-[10px] truncate font-bold uppercase tracking-widest">
            {disco.artista}
          </span>
        )}

        {/* Title — Fraunces for editorial character. Not a heading: dozens of
            cards per page would flood the document outline. This is the card's
            only link to the record, so the album title is its anchor text, and
            ::after stretches the hit area back over the whole card the way the
            removed overlay <a> did. The clamped text sits in the span so the
            link box itself never becomes a -webkit-box. */}
        <Link
          href={`/disco/${disco.slug}`}
          className="mt-0.5 block after:absolute after:inset-0 after:z-10 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <span
            id={titleId}
            className="font-display text-cream text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]"
            title={titulo}
          >
            {titulo}
          </span>
        </Link>

        {/* ── Price section ──────────────────────────────────────── */}
        {isUnavailable ? (
          <p className="mt-auto pt-2 text-dust text-sm font-medium">Indisponível {lojaComPrep}</p>
        ) : (
          <div className="mt-auto pt-2">
            {!HIDE_PRICE_HISTORY && (sparkline.length >= 2 || showOriginalPrice) && (
              <div className="flex items-center gap-2 mb-1">
                {sparkline.length >= 2 && <Sparkline values={sparkline} avg={disco.mediaPreco} />}
                {showOriginalPrice && (
                  <p className="text-dust text-xs line-through ml-auto tabular-nums">
                    {fmt(disco.mediaPreco)}
                  </p>
                )}
              </div>
            )}

            {/* Current price — bold, gold, large */}
            <p className="font-display text-gold font-black text-xl leading-tight tabular-nums">
              {fmt(disco.precoAtual)}
            </p>
          </div>
        )}
      </div>
    </article>
  );
});
