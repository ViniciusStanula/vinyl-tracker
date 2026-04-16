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

/** 40×16 px SVG sparkline showing the 30-day price trend. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 40, H = 16, PAD = 1;
  const pts = values
    .map((v, i) => {
      const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  // Green if price trended down, red if up
  const color = values[values.length - 1] <= values[0] ? "#10b981" : "#ef4444";
  return (
    <svg width={W} height={H} aria-hidden="true" className="shrink-0 opacity-75">
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

  const descontoPercent  = Math.round(disco.desconto * 100);
  const showOriginalPrice = descontoPercent > 0;
  const dealScore        = disco.dealScore ?? null;
  const confidenceLevel  = disco.confidenceLevel ?? null;
  const rating           = disco.rating;
  const stars            = rating ? Math.round(rating) : 0;
  const artistaSlug      = slugifyArtist(disco.artista);
  const sparkline        = disco.sparkline ?? [];

  // 3-state price status based on sparkline history
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

  // Score-3 cards get a subtle amber ring so they stand out in the grid
  const cardRing = dealScore === 3 ? " ring-2 ring-amber-500/50" : "";

  // Deal badge sits below the discount badge when both are present; otherwise
  // it floats to the top-left so it isn't orphaned mid-image.
  const dealBadgeTop = descontoPercent > 0 ? "top-10" : "top-2";

  return (
    <div className={`relative group bg-zinc-900 rounded-xl overflow-hidden flex flex-col${cardRing}`}>
      {/* Full-card link — covers the entire card */}
      <Link
        href={`/disco/${disco.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`Ver histórico de preços de ${disco.titulo}`}
      />

      {/* ── Album art ─────────────────────────────────────────── */}
      <div className="relative aspect-square bg-zinc-800 shrink-0 overflow-hidden">
        {disco.imgUrl ? (
          <Image
            src={disco.imgUrl}
            alt={disco.titulo}
            fill
            sizes="(max-width: 767px) 50vw, (max-width: 1199px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            unoptimized
            priority={priority}
            loading={priority ? undefined : "lazy"}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-5xl select-none">
            ♫
          </div>
        )}

        {/* Discount badge — larger, WCAG-AA: white on red-600 ≈ 5.3:1 */}
        {descontoPercent > 0 && (
          <div className="absolute top-2 left-2 z-20 bg-red-600 text-white text-sm font-bold px-2 py-1 rounded-md shadow-sm">
            -{descontoPercent}%
          </div>
        )}

        {/* Deal tier badge — shown when the scorer has assigned a tier */}
        {dealScore === 3 && (
          <div className={`absolute ${dealBadgeTop} left-2 z-20 bg-amber-500 text-zinc-950 text-xs font-bold px-2 py-1 rounded shadow-sm`}>
            🥇 Melhor Preço
          </div>
        )}
        {dealScore === 2 && (
          <div className={`absolute ${dealBadgeTop} left-2 z-20 bg-emerald-500 text-zinc-950 text-[11px] font-bold px-1.5 py-0.5 rounded shadow-sm`}>
            🥈 Ótima Oferta
          </div>
        )}
        {dealScore === 1 && (
          <div className={`absolute ${dealBadgeTop} left-2 z-20 bg-zinc-700 text-zinc-300 text-[10px] font-medium px-1.5 py-0.5 rounded`}>
            🥉 Boa Oferta
          </div>
        )}

        {/* Amazon quick link — visible on hover only */}
        <a
          href={disco.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-950/80 text-zinc-100 text-[10px] font-medium px-2 py-1 rounded-md"
          aria-label={`Ver ${disco.titulo} na Amazon`}
        >
          Amazon ↗
        </a>
      </div>

      {/* ── Info ──────────────────────────────────────────────── */}
      <div className="p-3 flex flex-col flex-1">
        {/* Artist — above title, muted, lighter weight */}
        <Link
          href={`/artista/${artistaSlug}`}
          className="relative z-20 block text-zinc-500 hover:text-amber-400 text-xs truncate transition-colors"
        >
          {disco.artista}
        </Link>

        {/* Title — primary, 2-line clamp; native tooltip shows full title on hover */}
        <h2
          className="text-zinc-100 text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] mt-0.5"
          title={disco.titulo}
        >
          {disco.titulo}
        </h2>

        {/* Star rating — below title, visually weighted */}
        {rating !== null && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-amber-400 text-xs" aria-hidden="true">
              {"★".repeat(stars)}
              {"☆".repeat(5 - stars)}
            </span>
            <span className="text-zinc-500 text-xs">{rating.toFixed(1)}</span>
          </div>
        )}

        {/* Genre tag */}
        {disco.estilo && (
          <span className="inline-block mt-1 text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full self-start">
            {disco.estilo}
          </span>
        )}

        {/* ── Price section ──────────────────────────────────── */}
        <div className="mt-auto pt-2">
          {/* Sparkline + crossed-out original price on the same row */}
          {(sparkline.length >= 2 || showOriginalPrice) && (
            <div className="flex items-center gap-2 mb-1">
              {sparkline.length >= 2 && <Sparkline values={sparkline} />}
              {showOriginalPrice && (
                <p className="text-zinc-600 text-xs line-through ml-auto">
                  {fmt(disco.mediaPreco)}
                </p>
              )}
            </div>
          )}

          {/* Current price — prominent (18 px bold) */}
          <p className="text-amber-400 font-bold text-[18px] leading-tight">
            {fmt(disco.precoAtual)}
          </p>

          {/* Price status label */}
          {statusPreco === "menor" && (
            <p className="text-[11px] mt-0.5 font-medium text-emerald-400">
              🟢 Menor preço histórico
            </p>
          )}
          {statusPreco === "aumento" && (
            <p className="text-[11px] mt-0.5 font-medium text-red-400">
              🔴 Aumento de preço
            </p>
          )}
          {statusPreco === "estavel" && (
            <p className="text-[11px] mt-0.5 font-medium text-blue-400">
              🔵 Preço estável
            </p>
          )}

          {/* Low-confidence warning — shown when deal is scored on sparse data */}
          {confidenceLevel === "low_confidence" && dealScore !== null && (
            <p className="text-[10px] mt-0.5 text-amber-600">
              ⚠️ Poucos dados disponíveis
            </p>
          )}

          {/* CTA — core feature, always visible */}
          <Link
            href={`/disco/${disco.slug}`}
            className="relative z-20 mt-3 w-full text-center text-xs font-medium text-zinc-400 border border-zinc-700 hover:border-amber-500 hover:text-amber-400 rounded-lg py-1.5 transition-colors block"
          >
            Ver Histórico
          </Link>
        </div>
      </div>
    </div>
  );
}
