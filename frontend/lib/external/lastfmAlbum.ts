import { unstable_cache } from "next/cache";

export interface LastfmAlbumInfo {
  listeners: number;
  playcount: number;
  wikiSummary: string | null;
}

// Kept in sync with crawler/lastfm.py `clean_album_title` (the enrichment
// cleaner). Colours are only stripped INSIDE brackets/parens so real titles
// ending in a colour word ("Back to Black", "Purple Rain") survive.
const VINYL_WORDS =
  /\b(vinyl|vinil|\d*x?lp|gram|\d+\s*g|colou?red|colorid[oa]|remaster(?:ed)?|reissue|gatefold|splatter|exclusive|amazon|180|140|150|200|220|clear|gold|green|silver|blue|red|black|white|orange|tangerine|purple|pink|yellow|translucent|opaque|marbled?|repress|anniversary|deluxe|edition|import(?:ad[oa])?|analog(?:ue)?|region|disc|disk|rpm|pressing|limited|special|expanded|extended|collector|numbered|bonus|box\s*set|explicit|blu.?ray|dvd|nacional|duplo|triplo|lacrado|selado|seminovo|promo|digipak|picture\s+disc)\b/i;

// Bare trailing junk without brackets, e.g. "8 Letters vinyl", "posh LP",
// "MELTDOWN 18cm". HARD format tokens only — never bare colours.
const TRAILING_JUNK =
  /(?:\s*[-:–|/]?\s*\b(?:vinyl|vinil|\d*x?lp|picture\s+disc|box\s?set|boxset|digipak|gatefold|\d+\s*g|\d+\s*gram(?:s|as)?|\d+\s*cm|\d+\s*rpm|\d+\s*"|nacional|importad[oa]|duplo|triplo|colorid[oa]|lacrado|selado|seminovo|promo|reissue|repress|remaster(?:ed)?|deluxe|exclusive|limited)\b\s*)+$/i;

// Bare "Nth Anniversary [Edition]" tail Amazon leaves without brackets.
const TRAILING_ANNIVERSARY =
  /\s*[-:–]?\s*(?:the\s+)?\d+(?:st|nd|rd|th)\s+anniversary(?:\s+edition)?\s*$/i;

// Leading format noise, e.g. "LP VINIL Foals - ..." or "- Vinil Disney - ...".
const LEADING_FORMAT =
  /^[\s-]*(?:(?:disco\s+de\s+vin(?:il|yl)|vinyl|vinil|\d*x?lp|cd)\b[\s-]*)+/i;

export function cleanAlbumTitle(title: string, artist: string): string {
  let t = title;
  // Strip bare "explicit_lyrics" suffix Amazon appends without brackets
  t = t.replace(/\s*explicit_lyrics\s*/gi, " ").trim();
  const escapedArtist = artist.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Strip leading format noise before the artist-prefix pass.
  t = t.replace(LEADING_FORMAT, "");
  // Strip "Artist - " / "Artist / " prefix (self-titled / combined listings).
  t = t.replace(new RegExp(`^${escapedArtist}\\s*[-/]\\s*`, "i"), "");
  // Amazon sometimes appends the artist after a bracket marker, e.g.
  // "... [Vinyl] Dolly Parton". Only that exact tail shape is a safe signal.
  const trailingArtist = new RegExp(`[\\]\\)]\\s*${escapedArtist}\\s*$`, "i").test(title);
  // Remove square bracket content e.g. [Disco de Vinil], [Vinyl], [Explicit]
  t = t.replace(/\s*\[[^\]]*\]/g, "");
  // Remove parenthetical vinyl/format descriptors
  t = t.replace(/\s*\([^)]*\)/g, (match) => (VINYL_WORDS.test(match) ? "" : match));
  // Remove variant suffix after last " - " e.g. "Album - Clear Gold Splatter"
  const dash = t.lastIndexOf(" - ");
  if (dash > 0 && VINYL_WORDS.test(t.slice(dash + 3))) {
    t = t.slice(0, dash);
  }
  t = t.replace(TRAILING_ANNIVERSARY, "");
  // Strip the trailing artist name only for the safe "[marker] Artist" tail,
  // and never empty the result (guards self-titled albums).
  if (trailingArtist) {
    const stripped = t.replace(new RegExp(`\\s*[-–]?\\s*${escapedArtist}\\s*$`, "i"), "").trim();
    if (stripped) t = stripped;
  }
  // Drop bare trailing format tokens; if that empties the title, keep pre-strip.
  const stripped = t.replace(TRAILING_JUNK, "").trim();
  t = stripped || t;
  return t.trim() || title.trim();
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

export const fetchLastfmAlbumCover = unstable_cache(
  async (artist: string, album: string): Promise<string | null> => {
    const apiKey = process.env.LASTFM_API_KEY;
    if (!apiKey) return null;
    try {
      // MusicBrainz titles can be wrapped in brackets e.g. "[Led Zeppelin IV]".
      // cleanAlbumTitle strips ALL bracket content, making the title empty.
      // Strip enclosing brackets first so cleanAlbumTitle sees the real title.
      const unwrapped = album.replace(/^\[(.+)\]$/, "$1").trim();
      const cleaned = cleanAlbumTitle(unwrapped, artist) || unwrapped;
      const url = new URL("https://ws.audioscrobbler.com/2.0/");
      url.searchParams.set("method", "album.getInfo");
      url.searchParams.set("artist", artist);
      url.searchParams.set("album", cleaned);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("format", "json");
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json() as {
        error?: number;
        album?: { image?: Array<{ "#text": string; size: string }> };
      };
      if (data.error || !data.album) return null;
      const images = data.album.image ?? [];
      for (const size of ["extralarge", "mega", "large", "medium"]) {
        const img = images.find((i) => i.size === size);
        if (img?.["#text"]) return img["#text"];
      }
      return null;
    } catch {
      return null;
    }
  },
  ["lastfm-album-cover-v2"],
  { revalidate: 86400 * 30 }
);

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
