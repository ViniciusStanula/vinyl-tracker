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
  emPromocao: boolean;
  desconto: number; // fraction, positive = price below historical average
}

export default function DiscoCard({
  disco,
  priority = false,
}: {
  disco: DiscoCardProps;
  priority?: boolean;
}) {
  const priceFormatted = disco.precoAtual.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  const descontoPercent = Math.round(disco.desconto * 100);

  // "Menor Preço" when ≥10% below average; "Melhor Desconto" when 5–9% below
  const badge =
    disco.emPromocao
      ? { label: "Menor Preço", cls: "bg-emerald-500 text-white" }
      : disco.desconto >= 0.05
      ? { label: "Melhor Desconto", cls: "bg-amber-500 text-zinc-950" }
      : null;

  const artistaSlug = slugifyArtist(disco.artista);

  return (
    <div className="relative group bg-zinc-900 rounded-xl overflow-hidden hover:bg-zinc-800 transition-colors">
      {/* Full-card link */}
      <Link
        href={`/disco/${disco.slug}`}
        className="absolute inset-0 z-10"
        aria-label={disco.titulo}
      />

      {/* Album art */}
      <div className="relative aspect-square bg-zinc-800">
        {disco.imgUrl ? (
          <Image
            src={disco.imgUrl}
            alt={disco.titulo}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
            className="object-cover"
            unoptimized
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-5xl select-none">
            ♫
          </div>
        )}

        {/* Badge as full-width bottom banner on the image */}
        {badge && (
          <div
            className={`absolute bottom-0 left-0 right-0 ${badge.cls} text-[11px] font-bold py-1 text-center`}
          >
            {badge.label}
          </div>
        )}

        {/* Quick Amazon link — appears on hover (desktop), z-20 above the card overlay */}
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

      {/* Info */}
      <div className="p-3">
        {/* Artist — links to artist page, above title */}
        <Link
          href={`/artista/${artistaSlug}`}
          className="relative z-20 block text-zinc-500 hover:text-amber-400 text-xs truncate transition-colors"
        >
          {disco.artista}
        </Link>

        <h3 className="text-zinc-100 text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem] mt-0.5">
          {disco.titulo}
        </h3>

        {/* Genre tag */}
        {disco.estilo && (
          <span className="inline-block mt-1 text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {disco.estilo}
          </span>
        )}

        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            <div className="flex items-baseline gap-1.5">
              <p className="text-amber-400 font-bold text-base leading-none">
                {priceFormatted}
              </p>
              {descontoPercent > 0 && (
                <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                  -{descontoPercent}%
                </span>
              )}
            </div>
            {disco.rating && (
              <p className="text-zinc-500 text-xs mt-1">
                ★ {disco.rating.toFixed(1)}
              </p>
            )}
          </div>

          {/* Arrow button — z-20 to stay above the full-card overlay */}
          <Link
            href={`/disco/${disco.slug}`}
            className="relative z-20 shrink-0 w-8 h-8 bg-amber-500 hover:bg-amber-400 rounded-full flex items-center justify-center text-zinc-950 transition-colors"
            aria-label={`Ver ${disco.titulo}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
