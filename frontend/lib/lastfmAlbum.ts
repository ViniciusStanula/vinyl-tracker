import { unstable_cache } from "next/cache";

export interface LastfmAlbumInfo {
  listeners: number;
  playcount: number;
  wikiSummary: string | null;
}

const VINYL_WORDS =
  /\b(vinyl|vinil|lp|gram|colou?red|remaster(?:ed)?|reissue|gatefold|splatter|exclusive|amazon|180|140|clear|gold|green|silver|blue|red|black|white|orange|tangerine|purple|pink|yellow|repress|anniversary|deluxe|edition|import|analog(?:ue)?|region|disc|disk|rpm|pressing|limited|special|expanded|extended|collector|numbered|bonus|box\s*set|explicit|blu.?ray|dvd)\b/i;

export function cleanAlbumTitle(title: string, artist: string): string {
  let t = title;
  // Strip bare "explicit_lyrics" suffix Amazon appends without brackets
  t = t.replace(/\s*explicit_lyrics\s*/gi, " ").trim();
  // Strip "Artist - " prefix (self-titled Amazon listings)
  const escapedArtist = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const prefix = new RegExp(`^${escapedArtist}\\s*-\\s*`, "i");
  t = t.replace(prefix, "");
  // Remove square bracket content e.g. [Disco de Vinil], [Vinyl], [Explicit]
  t = t.replace(/\s*\[[^\]]*\]/g, "");
  // Remove parenthetical vinyl/format descriptors
  t = t.replace(/\s*\([^)]*\)/g, (match) =>
    VINYL_WORDS.test(match) ? "" : match
  );
  // Remove color/variant suffix after last " - " e.g. "Album - Clear Gold Splatter"
  const dash = t.lastIndexOf(" - ");
  if (dash > 0 && VINYL_WORDS.test(t.slice(dash + 3))) {
    t = t.slice(0, dash);
  }
  // Strip trailing bare vinyl color/format words e.g. "1989 (Taylor's Version) Tangerine Vinyl" → "1989 (Taylor's Version)"
  t = t.replace(/(\s+\w+)?\s+(vinyl|vinil|lp)\s*$/i, (m, prefix) => {
    if (!prefix) return "";
    return VINYL_WORDS.test(prefix.trim()) ? "" : m;
  });
  // Strip trailing artist name e.g. "De Stijl [Vinyl] The White Stripes" → "De Stijl"
  const trailingArtist = new RegExp(`\\s+${escapedArtist}$`, "i");
  t = t.replace(trailingArtist, "");
  return t.trim();
}

function cleanWiki(html: string): string {
  return html
    .replace(/<a[^>]*href="https?:\/\/www\.last\.fm[^"]*"[^>]*>.*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function translateToPtBr(text: string): Promise<string | null> {
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text);
    url.searchParams.set("langpair", "en|pt-BR");
    if (process.env.MYMEMORY_EMAIL) url.searchParams.set("de", process.env.MYMEMORY_EMAIL);
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json() as {
      responseStatus: number;
      responseData?: { translatedText?: string };
    };
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) return null;
    return data.responseData.translatedText;
  } catch {
    return null;
  }
}

export const fetchLastfmAlbumInfo = unstable_cache(
  async (artist: string, album: string): Promise<LastfmAlbumInfo | null> => {
    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) return null;
    try {
      const url = new URL("https://ws.audioscrobbler.com/2.0/");
      url.searchParams.set("method", "album.getInfo");
      url.searchParams.set("artist", artist);
      url.searchParams.set("album", cleanAlbumTitle(album, artist));
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("format", "json");
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json() as {
        error?: number;
        album?: {
          listeners?: string;
          playcount?: string;
          wiki?: { summary?: string };
        };
      };
      if (data.error || !data.album) return null;
      const info = data.album;
      const listeners = parseInt(info.listeners ?? "0", 10);
      const rawSummary = info.wiki?.summary ? cleanWiki(info.wiki.summary) : null;
      // Only translate for mainstream albums (500k+ listeners) to stay within rate limits
      const wikiSummary = rawSummary && listeners >= 500_000
        ? await translateToPtBr(rawSummary)
        : null;
      return {
        listeners,
        playcount: parseInt(info.playcount ?? "0", 10),
        wikiSummary,
      };
    } catch {
      return null;
    }
  },
  ["lastfm-album-info"],
  { revalidate: 86400 }
);
