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

  const originalPriceFormatted = disco.mediaPreco.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

  const descontoPercent = Math.round(disco.desconto * 100);
  const showOriginalPrice = descontoPercent > 0;
  const isHotDeal = descontoPercent >= 30;

  const artistaSlug = slugifyArtist(disco.artista);

  return (
    <div className="relative group bg-zinc-900 rounded-xl overflow-hidden hover:bg-zinc-800 transition-colors flex flex-col">
      {/* Full-card link */}
      <Link
        href={`/disco/${disco.slug}`}
        className="absolute inset-0 z-10"
        aria-label={disco.titulo}
      />

      {/* Album art */}
      <div className="relative aspect-square bg-zinc-800 shrink-0">
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

        {/* Discount badge — top-left */}
        {descontoPercent > 0 && (
          <div className="absolute top-2 left-2 z-20 bg-red-600 text-white text-[11px] font-bold px-1.5 py-0.5 rounded">
            -{descontoPercent}%
          </div>
        )}

        {/* Oferta imperdível badge — below discount badge */}
        {isHotDeal && (
          <div className="absolute top-8 left-2 z-20 bg-amber-500 text-zinc-950 text-[10px] font-bold px-1.5 py-0.5 rounded">
            🔥 Oferta
          </div>
        )}

        {/* Rating pill — bottom-right overlay */}
        {disco.rating && (
          <div className="absolute bottom-2 right-2 z-20 flex items-center gap-0.5 bg-zinc-950/80 text-amber-400 text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
            <svg
              className="w-3 h-3 fill-current"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            {disco.rating.toFixed(1)}
          </div>
        )}

        {/* Quick Amazon link — appears on hover */}
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
      <div className="p-3 flex flex-col flex-1">
        {/* Artist */}
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

        {/* Price hierarchy */}
        <div className="mt-2 flex-1 flex flex-col justify-end">
          {showOriginalPrice && (
            <p className="text-zinc-500 text-xs line-through">
              {originalPriceFormatted}
            </p>
          )}
          <p className="text-amber-400 font-bold text-lg leading-tight">
            {priceFormatted}
          </p>

          {/* CTA — outline style, full width */}
          <Link
            href={`/disco/${disco.slug}`}
            className="relative z-20 mt-3 w-full text-center text-xs font-medium text-zinc-400 border border-zinc-700 hover:border-amber-500 hover:text-amber-400 rounded-lg py-1.5 transition-colors"
          >
            Ver Histórico
          </Link>
        </div>
      </div>
    </div>
  );
}
