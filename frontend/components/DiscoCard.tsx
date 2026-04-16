import Image from "next/image";
import Link from "next/link";
import { slugifyArtist } from "@/lib/slugify";

export interface DiscoCardProps {
  id: string;
  slug: string;
  titulo: string;
  artista: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  rating: number | null;
  precoAtual: number;
  mediaPreco: number;
  emPromocao: boolean;
  desconto: number;
  sparkline?: number[];
  /** Scoring tier: 1 = Boa Oferta, 2 = Ótima Oferta, 3 = Melhor Preço, null = no deal */
  dealScore?: number | null;
  /** Backend confidence tier; "low_confidence" triggers a data-warning indicator */
  confidenceLevel?: string | null;
}

/** 44×18 px SVG sparkline showing the 30-day price trend. */
function Sparkline({ values }: { values: number[] }) {
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
  const trending = values[values.length - 1] <= values[0];
  const color = trending ? "#35c47a" : "#b81828";
  return (
    <svg width={W} height={H} aria-hidden="true" className="shrink-0 opacity-80">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function DiscoCard({
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

  const descontoPercent   = Math.round(disco.desconto * 100);
  const showOriginalPrice = descontoPercent > 0;
  const dealScore         = disco.dealScore ?? null;
  const confidenceLevel   = disco.confidenceLevel ?? null;
  const rating            = disco.rating;
  const stars             = rating ? Math.round(rating) : 0;
  const artistaSlug       = slugifyArtist(disco.artista);
  const sparkline         = disco.sparkline ?? [];

  const sparklineMin = sparkline.length >= 2 ? Math.min(...sparkline) : null;
  const sparklineAvg =
    sparkline.length >= 2
      ? sparkline.reduce((a, b) => a + b, 0) / sparkline.length
      : null;
  const statusPreco: "menor" | "aumento" | "estavel" | null =
    sparklineMin !== null && sparklineAvg !== null
      ? disco.precoAtual <= sparklineMin
        ? "menor"
        : disco.precoAtual > sparklineAvg * 1.03
        ? "aumento"
        : "estavel"
      : null;

  // Score-3 gets a subtle gold ring
  const cardRing = dealScore === 3 ? " ring-1 ring-gold/40" : "";
  const dealBadgeTop = descontoPercent > 0 ? "top-[3.25rem]" : "top-2";

  return (
    <div className={`relative group bg-sleeve rounded-xl overflow-hidden flex flex-col border border-groove hover:border-wax transition-colors duration-200${cardRing}`}>
      {/* Full-card link */}
      <Link
        href={`/disco/${disco.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`Ver histórico de preços de ${disco.titulo}`}
      />

      {/* ── Album art ─────────────────────────────────────────────── */}
      <div className="relative aspect-square bg-label shrink-0 overflow-hidden">
        {disco.imgUrl ? (
          <Image
            src={disco.imgUrl}
            alt={disco.titulo}
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.06]"
            unoptimized
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-patina text-5xl select-none">
            ♪
          </div>
        )}

        {/* Subtle gradient overlay — bottom fade for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-record/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Discount badge — circular sticker */}
        {descontoPercent > 0 && (
          <div className="absolute top-2 left-2 z-20 w-[2.6rem] h-[2.6rem] rounded-full bg-cut text-cream flex flex-col items-center justify-center shadow-lg shadow-cut/30">
            <span className="text-[8px] font-bold leading-none tracking-wide">-</span>
            <span className="text-[14px] font-black leading-none">{descontoPercent}%</span>
          </div>
        )}

        {/* Deal tier badges */}
        {dealScore === 3 && (
          <div className={`absolute ${dealBadgeTop} left-2 z-20 bg-gold text-record text-[10px] font-black px-2 py-0.5 rounded shadow-md flex items-center gap-1`}>
            ✦ Melhor Preço
          </div>
        )}
        {dealScore === 2 && (
          <div className={`absolute ${dealBadgeTop} left-2 z-20 bg-deal text-cream text-[10px] font-bold px-2 py-0.5 rounded shadow-md`}>
            ✓ Ótima Oferta
          </div>
        )}
        {dealScore === 1 && (
          <div className={`absolute ${dealBadgeTop} left-2 z-20 bg-groove text-parchment text-[10px] font-medium px-2 py-0.5 rounded border border-wax/50`}>
            Boa Oferta
          </div>
        )}

        {/* Amazon quick-link — hover only */}
        <a
          href={disco.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-record/80 text-cream text-[10px] font-medium px-2 py-1 rounded-md backdrop-blur-sm"
          aria-label={`Ver ${disco.titulo} na Amazon`}
        >
          Amazon ↗
        </a>
      </div>

      {/* ── Info ──────────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col flex-1">
        {/* Artist */}
        <Link
          href={`/artista/${artistaSlug}`}
          className="relative z-20 block text-parchment hover:text-gold text-xs truncate transition-colors font-medium"
        >
          {disco.artista}
        </Link>

        {/* Title — Fraunces for editorial character */}
        <h2
          className="text-cream text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] mt-0.5"
          style={{ fontFamily: "var(--font-fraunces, serif)" }}
          title={disco.titulo}
        >
          {disco.titulo}
        </h2>

        {/* Star rating */}
        {rating !== null && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-gold text-xs" aria-hidden="true">
              {"★".repeat(stars)}{"☆".repeat(5 - stars)}
            </span>
            <span className="text-dust text-xs">{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Genre tag */}
        {disco.estilo && (
          <span className="inline-block mt-1 text-[10px] text-parchment bg-groove/50 border border-wax/40 px-2 py-0.5 rounded-full self-start">
            {disco.estilo}
          </span>
        )}

        {/* ── Price section ──────────────────────────────────────── */}
        <div className="mt-auto pt-2">
          {(sparkline.length >= 2 || showOriginalPrice) && (
            <div className="flex items-center gap-2 mb-1">
              {sparkline.length >= 2 && <Sparkline values={sparkline} />}
              {showOriginalPrice && (
                <p className="text-dust text-xs line-through ml-auto tabular-nums">
                  {fmt(disco.mediaPreco)}
                </p>
              )}
            </div>
          )}

          {/* Current price — bold, gold, large */}
          <p
            className="text-gold font-black text-xl leading-tight tabular-nums"
            style={{ fontFamily: "var(--font-fraunces, serif)" }}
          >
            {fmt(disco.precoAtual)}
          </p>

          {/* Price status */}
          {statusPreco === "menor" && (
            <p className="text-[11px] mt-0.5 font-semibold text-deallit">
              ↓ Menor preço histórico
            </p>
          )}
          {statusPreco === "aumento" && (
            <p className="text-[11px] mt-0.5 font-semibold text-cut">
              ↑ Aumento de preço
            </p>
          )}
          {statusPreco === "estavel" && (
            <p className="text-[11px] mt-0.5 text-parchment/60">
              → Preço estável
            </p>
          )}

          {/* Low-confidence warning */}
          {confidenceLevel === "low_confidence" && dealScore !== null && (
            <p className="text-[10px] mt-0.5 text-goldmute">
              ⚠ Poucos dados disponíveis
            </p>
          )}

          {/* CTA */}
          <Link
            href={`/disco/${disco.slug}`}
            className="relative z-20 mt-2.5 w-full text-center text-xs font-semibold text-parchment border border-groove hover:border-gold hover:text-gold rounded-lg py-1.5 transition-all block"
          >
            Ver Histórico de Preços
          </Link>
        </div>
      </div>
    </div>
  );
}
