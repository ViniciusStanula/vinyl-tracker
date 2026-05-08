import { unstable_cache } from "next/cache";

export interface LastfmAlbumInfo {
  listeners: number;
  playcount: number;
  wikiSummary: string | null;
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
      url.searchParams.set("album", album);
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
