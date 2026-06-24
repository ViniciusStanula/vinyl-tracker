import { unstable_cache } from "next/cache";

const BASE = "https://ws.audioscrobbler.com/2.0/";

interface LfmArtist {
  name: string;
}
interface LfmResponse {
  artists?: { artist?: LfmArtist[] };
}

async function fetchPage(apiKey: string, page: number): Promise<LfmArtist[]> {
  const url =
    `${BASE}?method=chart.getTopArtists` +
    `&api_key=${encodeURIComponent(apiKey)}` +
    `&format=json&limit=500&page=${page}`;

  const res = await fetch(url);
  if (!res.ok) return [];
  const d = (await res.json()) as LfmResponse;
  return d.artists?.artist ?? [];
}

async function _fetchTopArtists(): Promise<string[]> {
  const key = process.env.LASTFM_API_KEY;
  if (!key) return [];

  // Top-2000 (4 pages x 500). Widened from top-1000 so the homepage carousel's
  // best-deal-per-artist pool reaches beyond the most mainstream names and can
  // surface stronger discounts from a broader set of recognizable artists.
  const pages = await Promise.all(
    [1, 2, 3, 4].map((p) => fetchPage(key, p).catch(() => [] as LfmArtist[])),
  );

  return [...new Set(pages.flat().map((a) => a.name).filter(Boolean))];
}

// Cache Last.fm chart for 1 week — artist lineup changes slowly.
// Tag `lastfm` allows manual invalidation independent of price data.
export const fetchTopArtists = unstable_cache(
  _fetchTopArtists,
  ["lastfm-top-artists"],
  { tags: ["lastfm"], revalidate: 604800 },
);
