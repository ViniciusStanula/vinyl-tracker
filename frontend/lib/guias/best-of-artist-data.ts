import { prisma } from "@/lib/db/prisma";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { ARTIST_VIDEOS, ARTIST_ALIASES, ARTIST_EXCLUDE } from "./best-of-artist-videos";
import { ALBUM_BLURBS } from "./best-of-artist-content";

// Overrides for titles too messy to clean automatically (e.g. a marketplace
// listing's full ad copy). Keyed by [artist slug][dedup key] -> display title.
const ARTIST_DISPLAY_NAMES: Record<string, Record<string, string>> = {
  metallica: {
    "metallica 72 seasons vinil edição limitada lp colorido amarelo e preto exclusivo walmart": "72 Seasons",
  },
  megadeth: {
    "so far so good: so what": "So Far, So Good... So What!",
    megadeth: "Megadeth",
  },
};

// Real studio albums we don't currently have a vinyl listing for. A ranking
// should reflect the actual discography, not just what's in stock — these
// get ranked and shown like any other album, just without a price link, and
// with a MusicBrainz Cover Art Archive image instead of our own product photo.
interface ExtraAlbum {
  mbid: string;
  title: string;
  year: number;
  mbRating: number;
  mbRatingVotes: number;
}

const ARTIST_EXTRA_ALBUMS: Record<string, ExtraAlbum[]> = {
  metallica: [
    { mbid: "8fd32554-02a7-3788-a761-7012e0e75e55", title: "ReLoad", year: 1997, mbRating: 3.25, mbRatingVotes: 45 },
  ],
  "iron-maiden": [
    { mbid: "169361b5-af6f-34ca-b8f2-13605a7f9691", title: "Piece of Mind", year: 1983, mbRating: 4.4, mbRatingVotes: 29 },
    { mbid: "c4a2262d-08bf-35ba-846c-79209b1121c9", title: "Virtual XI", year: 1998, mbRating: 2.45, mbRatingVotes: 15 },
    { mbid: "2220348e-c3f7-4da7-9cad-d84530077234", title: "The Book of Souls", year: 2015, mbRating: 4.0, mbRatingVotes: 12 },
  ],
  megadeth: [
    { mbid: "5410e871-d248-384b-ad73-0cb23a543cef", title: "Killing Is My Business... And Business Is Good!", year: 1985, mbRating: 3.5, mbRatingVotes: 12 },
    { mbid: "8f37e58c-0ab8-3393-88c0-fdb41488f233", title: "Cryptic Writings", year: 1997, mbRating: 3.75, mbRatingVotes: 11 },
    { mbid: "49e5d092-0e76-3d60-a994-160a50bd2b7e", title: "Risk", year: 1999, mbRating: 2.9, mbRatingVotes: 9 },
    { mbid: "e165f024-3fab-4002-aad9-18da9c515d2a", title: "Endgame", year: 2009, mbRating: 3.7, mbRatingVotes: 10 },
    { mbid: "41acf292-76c0-4c00-bd69-c3c5ebb7c593", title: "Th1rt3en", year: 2011, mbRating: 3.35, mbRatingVotes: 9 },
  ],
};

function caaCoverUrl(mbid: string): string {
  return `https://coverartarchive.org/release-group/${mbid}/front-500`;
}

export interface ArtistProfile {
  slug: string;
  name: string;
  artistaLike: string; // SQL ILIKE pattern matching Disco.artista for this artist
  // Portuguese preposition/article contraction before this artist's name —
  // "do" (o Metallica), "da" (a Anitta), "de" (no article) — so the page can
  // render "os melhores discos {article} {name}" grammatically.
  article: string;
}

// Add new artists here — one entry per /guias/melhores-discos/[slug] page.
export const BEST_OF_ARTISTS: ArtistProfile[] = [
  { slug: "metallica", name: "Metallica", artistaLike: "%Metallica%", article: "do" },
  { slug: "iron-maiden", name: "Iron Maiden", artistaLike: "%Iron Maiden%", article: "do" },
  { slug: "megadeth", name: "Megadeth", artistaLike: "%Megadeth%", article: "do" },
];

export function getArtistProfile(slug: string): ArtistProfile | undefined {
  return BEST_OF_ARTISTS.find((a) => a.slug === slug);
}

export interface RankedAlbum {
  mbid: string;
  title: string;
  year: number | null;
  score: number;
  mbRating: number | null;
  mbRatingVotes: number;
  lastfmListeners: number;
  amazonRating: number | null;
  reviewCount: number;
  imgUrl: string | null;
  discoSlug: string | null;
  videoId: string | null;
  blurb: string | null;
}

// Escapes a string for safe use inside a RegExp.
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Some catalog titles lead with "Artist - Album [format]" (e.g. "Iron Maiden
// - Dance Of Death [Disco de Vinil]") instead of trailing edition junk. Strip
// that leading "{artist} - " prefix first so the trailing-junk stripper below
// doesn't mistake the real album name for a dash-tail to discard.
function stripArtistPrefix(titulo: string, artistName: string): string {
  const re = new RegExp(`^${escapeRegExp(artistName)}\\s*[-:]\\s*`, "i");
  return titulo.replace(re, "");
}

// Strips edition/pressing noise so "Metallica (Remastered)" and "Metallica
// (Deluxe Box Set)" collapse to the same dedup key — same album, different
// mb_mbid matches for different pressings.
function dedupKey(titulo: string, artistName: string): string {
  const stripped = stripArtistPrefix(titulo, artistName)
    .replace(/\s*[\[(][^\])]*[\])]/g, "")
    .replace(/\s+[-–]\s+.*$/, "")
    .trim()
    .toLowerCase();
  return stripped || titulo.trim().toLowerCase();
}

// Same cleanup as dedupKey, but case-preserving — used for on-page display.
function cleanDisplayTitle(titulo: string, artistName: string): string {
  const cleaned = stripArtistPrefix(titulo, artistName)
    .replace(/\s*[\[(][^\])]*[\])]/g, "")
    .replace(/\s+[-–]\s+.*$/, "")
    .trim();
  return cleaned || titulo.trim();
}

function bayesian(v: number, R: number, m: number, C: number): number {
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

interface AlbumRow {
  mb_mbid: string;
  best_titulo: string;
  best_slug: string | null;
  best_img: string | null;
  year: string | null;
  rating: number | null;
  votes: number | null;
  listeners: number | null; // null = no Last.fm data available (album outside our catalog)
  amzrating: number | null;
  reviews: number | null;
}

async function fetchRankedAlbums(artist: ArtistProfile): Promise<RankedAlbum[]> {
  const rows = await prisma.$queryRaw<AlbumRow[]>`
    SELECT
      mb_mbid,
      (array_agg(titulo ORDER BY "reviewCount" DESC NULLS LAST))[1]  AS best_titulo,
      (array_agg(slug   ORDER BY "reviewCount" DESC NULLS LAST))[1]  AS best_slug,
      (array_agg("imgUrl" ORDER BY "reviewCount" DESC NULLS LAST))[1] AS best_img,
      MAX(mb_first_release_date) AS year,
      MAX(mb_rating)      AS rating,
      MAX(mb_rating_votes) AS votes,
      MAX(lastfm_listeners) AS listeners,
      MAX(rating::float)  AS amzrating,
      SUM("reviewCount")  AS reviews
    FROM "Disco"
    WHERE artista ILIKE ${artist.artistaLike}
      AND disponivel = TRUE
      AND (format IS NULL OR format = 'vinyl')
      AND mb_mbid IS NOT NULL
      AND mb_primary_type = 'Album'
    GROUP BY mb_mbid
  `;

  // Collapse same-album/different-pressing mbid duplicates, keeping the
  // variant with real MusicBrainz rating data (or the most Last.fm listeners
  // as a tiebreak when neither has ratings). Colloquial reissue titles that
  // MusicBrainz treats as a different release-group (e.g. "The Black Album")
  // get remapped to their canonical key first via ARTIST_ALIASES.
  const aliases = ARTIST_ALIASES[artist.slug] ?? {};
  const byKey = new Map<string, AlbumRow>();
  for (const row of rows) {
    const rawKey = dedupKey(row.best_titulo, artist.name);
    const key = aliases[rawKey] ?? rawKey;
    const existing = byKey.get(key);
    if (
      !existing ||
      (row.votes ?? 0) > (existing.votes ?? 0) ||
      ((row.votes ?? 0) === (existing.votes ?? 0) && (row.listeners ?? 0) > (existing.listeners ?? 0))
    ) {
      byKey.set(key, row);
    }
  }

  const excluded = ARTIST_EXCLUDE[artist.slug] ?? new Set<string>();
  const fromCatalog = [...byKey.values()].filter(
    (r) => ((r.votes ?? 0) > 0 || (r.listeners ?? 0) >= 1000) && !excluded.has(dedupKey(r.best_titulo, artist.name))
  );

  // Add real albums we don't have a vinyl listing for, skipping any that
  // somehow already matched from the catalog (avoids a double entry).
  const catalogKeys = new Set(fromCatalog.map((r) => dedupKey(r.best_titulo, artist.name)));
  const extras: AlbumRow[] = (ARTIST_EXTRA_ALBUMS[artist.slug] ?? [])
    .filter((e) => !catalogKeys.has(dedupKey(e.title, artist.name)))
    .map((e) => ({
      mb_mbid: e.mbid,
      best_titulo: e.title,
      best_slug: null,
      best_img: null,
      year: String(e.year),
      rating: e.mbRating,
      votes: e.mbRatingVotes,
      listeners: null, // no Last.fm data for albums outside our catalog — not "zero popularity"
      amzrating: null,
      reviews: 0,
    }));

  const candidates = [...fromCatalog, ...extras];

  const rated = candidates.filter((r) => (r.votes ?? 0) > 0 && (r.rating ?? -1) > 0);
  const C = rated.length
    ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length
    : 4.0;
  const sortedVotes = rated.map((r) => r.votes ?? 0).sort((a, b) => a - b);
  const m = sortedVotes.length
    ? sortedVotes[Math.max(0, Math.ceil(0.75 * sortedVotes.length) - 1)]
    : 30;

  // Popularity signal, scaled 0-5 relative to this artist's own most-listened
  // album — log-scaled so one runaway hit doesn't flatten everyone else.
  // An album missing an MB rating (e.g. no votes yet) still gets ranked fairly
  // if it's genuinely popular, instead of being buried under a flat penalty.
  const maxListeners = Math.max(1, ...candidates.map((r) => r.listeners ?? 0));
  const listenerScore = (listeners: number) =>
    5 * (Math.log(listeners + 1) / Math.log(maxListeners + 1));
  // Median listener score among candidates that actually have Last.fm data —
  // used as a neutral stand-in for albums outside our catalog (extras), so
  // missing data reads as "unknown popularity", not "nobody listens to this".
  const knownListenerScores = candidates
    .filter((r) => r.listeners !== null)
    .map((r) => listenerScore(r.listeners ?? 0))
    .sort((a, b) => a - b);
  const neutralListenerScore = knownListenerScores.length
    ? knownListenerScores[Math.floor(knownListenerScores.length / 2)]
    : 2.5;

  const videoMap = ARTIST_VIDEOS[artist.slug] ?? {};
  const blurbMap = ALBUM_BLURBS[artist.slug] ?? {};
  const displayNameMap = ARTIST_DISPLAY_NAMES[artist.slug] ?? {};

  const ranked: RankedAlbum[] = candidates.map((r) => {
    const hasRating = (r.votes ?? 0) > 0 && (r.rating ?? -1) > 0;
    const ratingComponent = hasRating ? bayesian(r.votes!, r.rating!, m, C) : C;
    const listenerComponent = r.listeners === null ? neutralListenerScore : listenerScore(r.listeners);
    const score = 0.6 * ratingComponent + 0.4 * listenerComponent;
    const key = dedupKey(r.best_titulo, artist.name);
    return {
      mbid: r.mb_mbid,
      title: displayNameMap[key] ?? cleanDisplayTitle(r.best_titulo, artist.name),
      year: r.year ? Number(r.year.slice(0, 4)) : null,
      score,
      mbRating: r.rating && r.rating > 0 ? r.rating : null,
      mbRatingVotes: r.votes ?? 0,
      lastfmListeners: r.listeners ?? 0,
      amazonRating: r.amzrating ?? null,
      reviewCount: Number(r.reviews ?? 0),
      imgUrl: r.best_img ?? caaCoverUrl(r.mb_mbid),
      discoSlug: r.best_slug,
      videoId: videoMap[key] ?? null,
      blurb: blurbMap[key] ?? null,
    };
  });

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

const _getBestAlbums = unstable_cache(
  async (slug: string): Promise<RankedAlbum[]> => {
    const artist = getArtistProfile(slug);
    if (!artist) return [];
    return fetchRankedAlbums(artist);
  },
  ["best-of-artist"],
  { tags: ["prices"], revalidate: 86400 }
);

export const getBestAlbums = cache(_getBestAlbums);
