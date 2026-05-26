"use client";

import { useState } from "react";

export interface AlbumCardProps {
  title: string;
  artist: string;
  year: number;
  mb_rgid: string;
  weighted_score: number;
  discogs_rating?: number;
  discogs_reviews?: number;
  coverUrl?: string | null;
  rank?: number;
  size?: "sm" | "lg";
}

function VinylPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-groove">
      <svg viewBox="0 0 64 64" fill="none" className="w-1/2 h-1/2 opacity-30" aria-hidden="true">
        <circle cx="32" cy="32" r="30" fill="#d98f0e" opacity="0.4" />
        <circle cx="32" cy="32" r="22" fill="#0c0a08" />
        <circle cx="32" cy="32" r="14" fill="#2b1e17" />
        <circle cx="32" cy="32" r="5" fill="#d98f0e" opacity="0.5" />
        <circle cx="32" cy="32" r="2" fill="#0c0a08" />
      </svg>
    </div>
  );
}

// Cover Art Archive URL — derived from mb_rgid, no API key needed.
// Resolves via a redirect to the actual image on archive.org.
function caaCoverUrl(mbid: string) {
  return `https://coverartarchive.org/release-group/${mbid}/front-500`;
}

type ImgState = "lastfm" | "caa" | "none";

export default function AlbumCard({
  title,
  artist,
  year,
  mb_rgid,
  weighted_score,
  discogs_rating,
  discogs_reviews,
  coverUrl,
  rank,
  size = "sm",
}: AlbumCardProps) {
  const initial: ImgState = coverUrl ? "lastfm" : "caa";
  const [imgState, setImgState] = useState<ImgState>(initial);

  const src =
    imgState === "lastfm" ? coverUrl :
    imgState === "caa"    ? caaCoverUrl(mb_rgid) :
    null;

  const onError = () =>
    setImgState((s) => (s === "lastfm" ? "caa" : "none"));

  return (
    <div className="flex flex-col gap-2 group">
      <div className="relative aspect-square rounded-lg overflow-hidden bg-groove ring-1 ring-white/5 transition-transform duration-200 ease-out group-hover:scale-[1.02] group-hover:shadow-xl group-hover:shadow-black/40 select-none">
        {src ? (
          <img
            src={src}
            alt={`${title} — ${artist}`}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={onError}
          />
        ) : (
          <VinylPlaceholder />
        )}

        {/* Rank badge */}
        {rank !== undefined && (
          <div className="absolute top-2 left-2 bg-record/85 backdrop-blur-sm rounded px-1.5 py-0.5 text-[10px] font-bold text-parchment/70 tabular-nums leading-none">
            #{rank}
          </div>
        )}

        {/* Score badge */}
        <div className="absolute bottom-2 right-2 bg-record/85 backdrop-blur-sm rounded px-1.5 py-0.5 text-xs font-bold text-gold tabular-nums leading-none border border-gold/15">
          {weighted_score.toFixed(2)}
        </div>
      </div>

      <div className="space-y-0.5 px-0.5">
        <p className={`text-cream font-semibold leading-snug line-clamp-2 ${size === "lg" ? "text-sm" : "text-xs"}`}>
          {title}
        </p>
        <p className="text-parchment/70 text-xs leading-tight truncate">{artist}</p>
        <p className="text-dust text-xs tabular-nums">{year}</p>
        {size === "lg" && discogs_rating !== undefined && discogs_reviews !== undefined && (
          <p className="text-parchment/80 text-xs pt-0.5">
            <span className="text-gold/90">{discogs_rating.toFixed(2)}</span>
            <span className="text-dust"> · {discogs_reviews.toLocaleString("pt-BR")} aval.</span>
          </p>
        )}
      </div>
    </div>
  );
}
