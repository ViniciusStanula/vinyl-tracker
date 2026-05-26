import { readFileSync } from "fs";
import { join } from "path";

interface RawAlbum {
  title: string;
  year: number;
  mb_rgid: string;
  match_strategy: string;
  discogs_id: number;
  discogs_reviews: number;
  discogs_rating: number;
  cover_path: string;
}

interface RawArtist {
  mbid: string;
  name: string;
  genre: string;
  sub_genre: string;
  albums: RawAlbum[];
}

export interface ScoredAlbum {
  title: string;
  year: number;
  mb_rgid: string;
  discogs_reviews: number;
  discogs_rating: number;
  weighted_score: number;
  artist: string;
  cover_path: string;
}

export interface SubgenreData {
  slug: string;
  name: string;
  albumCount: number;
  artistCount: number;
  topAlbums: ScoredAlbum[];
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function p75(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(0.75 * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function bayesian(v: number, R: number, m: number, C: number): number {
  return (v / (v + m)) * R + (m / (v + m)) * C;
}

let _cache: SubgenreData[] | null = null;

export function getRockSubgenres(): SubgenreData[] {
  if (_cache) return _cache;

  const raw: RawArtist[] = JSON.parse(
    readFileSync(join(process.cwd(), "..", "enriched_data.json"), "utf-8")
  );

  const rockArtists = raw.filter((a) => a.genre === "rock");

  type Entry = { albums: (RawAlbum & { artist: string })[]; artistNames: Set<string> };
  const bySubgenre = new Map<string, Entry>();

  for (const artist of rockArtists) {
    if (!bySubgenre.has(artist.sub_genre)) {
      bySubgenre.set(artist.sub_genre, { albums: [], artistNames: new Set() });
    }
    const entry = bySubgenre.get(artist.sub_genre)!;
    entry.artistNames.add(artist.name);
    for (const album of artist.albums) {
      entry.albums.push({ ...album, artist: artist.name });
    }
  }

  const result: SubgenreData[] = [];

  for (const [subgenre, { albums, artistNames }] of bySubgenre) {
    const rated = albums.filter((a) => a.discogs_rating > 0 && a.discogs_reviews > 0);

    const C =
      rated.length > 0
        ? rated.reduce((s, a) => s + a.discogs_rating, 0) / rated.length
        : 3.5;

    const sortedReviews = rated.map((a) => a.discogs_reviews).sort((a, b) => a - b);
    const m = Math.max(50, p75(sortedReviews));

    const scored: ScoredAlbum[] = rated.map((a) => ({
      title: a.title,
      year: a.year,
      mb_rgid: a.mb_rgid,
      discogs_reviews: a.discogs_reviews,
      discogs_rating: a.discogs_rating,
      weighted_score: bayesian(a.discogs_reviews, a.discogs_rating, m, C),
      artist: a.artist,
      cover_path: a.cover_path,
    }));

    scored.sort((a, b) => b.weighted_score - a.weighted_score);

    result.push({
      slug: slugify(subgenre),
      name: subgenre,
      albumCount: albums.length,
      artistCount: artistNames.size,
      topAlbums: scored,
    });
  }

  result.sort((a, b) => b.albumCount - a.albumCount);

  _cache = result;
  return result;
}

export function getSubgenre(slug: string): SubgenreData | undefined {
  return getRockSubgenres().find((s) => s.slug === slug);
}
