import Image from "next/image";
import Link from "next/link";

export interface DiscoCardProps {
  id: string;
  slug: string;
  titulo: string;
  artista: string;
  imgUrl: string | null;
  url: string;
  rating: number | null;
  precoAtual: number;
  emPromocao: boolean;
}

export default function DiscoCard({ disco }: { disco: DiscoCardProps }) {
  const priceFormatted = disco.precoAtual.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  const badge =
    disco.emPromocao
      ? { label: "Menor Preço", cls: "bg-emerald-500" }
      : disco.rating && disco.rating >= 4.5
      ? { label: "Melhor Avaliado", cls: "bg-blue-500" }
      : null;

  const stars = disco.rating ? Math.round(disco.rating) : 0;

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
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-5xl select-none">
            ♫
          </div>
        )}

        {badge && (
          <span
            className={`absolute top-2 left-2 ${badge.cls} text-white text-[11px] font-bold px-2 py-0.5 rounded-md`}
          >
            {badge.label}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="text-zinc-100 text-sm font-semibold leading-snug line-clamp-2 min-h-[2.5rem]">
          {disco.titulo}
        </h3>
        <p className="text-zinc-500 text-xs truncate mt-0.5">{disco.artista}</p>

        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div>
            <p className="text-amber-400 font-bold text-base leading-none">
              {priceFormatted}
            </p>
            {disco.rating && (
              <p className="text-zinc-500 text-xs mt-1">
                {"★".repeat(stars)}{"☆".repeat(5 - stars)}{" "}
                <span className="text-zinc-400">{disco.rating.toFixed(1)}</span>
              </p>
            )}
          </div>

          {/* Disco page button — z-20 so it stays above the full-card link overlay */}
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
