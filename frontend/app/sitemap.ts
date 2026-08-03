import type { MetadataRoute } from "next";
import {
  SITEMAP_BASE,
  getSitemapArtists,
  getSitemapDiscosForShard,
  getSitemapEstilos,
  getSitemapPaises,
  getLatestDiscoUpdate,
  DISCO_SHARDS,
  type DiscoShard,
} from "@/lib/db/sitemap";
import { getRockSubgenres } from "@/lib/guias/rock-data";
import { BEST_OF_ARTISTS } from "@/lib/guias/best-of-artist-data";

export const revalidate = 86400; // regenerate every 24 hours — sitemap staleness is fine for SEO

export async function generateSitemaps() {
  const discoShards = DISCO_SHARDS.map((shard) => ({ id: `discos-${shard}` }));
  return [{ id: "estatico" }, { id: "artistas" }, ...discoShards, { id: "estilos" }, { id: "paises" }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  if (id === "estatico") {
    const [rockSubgenres, latestUpdate] = await Promise.all([
      Promise.resolve(getRockSubgenres()),
      getLatestDiscoUpdate(),
    ]);
    // Articles with known update dates; listing pages use latestUpdate (real price-change signal).
    // top-artistas-spotify updates daily with Spotify data, so latestUpdate is used there too.
    const ARTICLES_MODIFIED = new Date("2026-06-25");
    const ROCK_GUIDE_DATE   = new Date("2026-05-26");
    return [
      { url: SITEMAP_BASE,                                              lastModified: latestUpdate,       changeFrequency: "daily",   priority: 1.0 },
      { url: `${SITEMAP_BASE}/disco`,                                   lastModified: latestUpdate,       changeFrequency: "daily",   priority: 0.8 },
      { url: `${SITEMAP_BASE}/ofertas`,                                 lastModified: latestUpdate,       changeFrequency: "daily",   priority: 0.8 },
      { url: `${SITEMAP_BASE}/discos-abaixo-de-200`,                    lastModified: latestUpdate,       changeFrequency: "daily",   priority: 0.7 },
      { url: `${SITEMAP_BASE}/artistas-mais-ouvidos`,                   lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
      { url: `${SITEMAP_BASE}/estilos`,                                 lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.7 },
      { url: `${SITEMAP_BASE}/paises`,                                  lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
      { url: `${SITEMAP_BASE}/artistas`,                                lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
      // The A-Z index is one route per initial, so the letter pages need their
      // own entries — /artistas itself only links to them, it no longer lists
      // any artist. Individual artist pages stay in the artistas shard.
      ...[..."abcdefghijklmnopqrstuvwxyz", "outros"].map((letra) => ({
        url: `${SITEMAP_BASE}/artistas/${letra}`,
        lastModified: latestUpdate,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
      { url: `${SITEMAP_BASE}/sobre`,                                   lastModified: new Date("2026-01-01"), changeFrequency: "yearly", priority: 0.3 },
      { url: `${SITEMAP_BASE}/alertas`,                                 lastModified: new Date("2026-07-31"), changeFrequency: "monthly", priority: 0.7 },
      { url: `${SITEMAP_BASE}/guias`,                                   lastModified: ARTICLES_MODIFIED,  changeFrequency: "weekly",  priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/top-artistas-spotify`,              lastModified: latestUpdate,       changeFrequency: "daily",   priority: 0.7 },
      { url: `${SITEMAP_BASE}/guias/como-cuidar-de-discos-de-vinil`,   lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/vinil-colorido-e-picture-disc`,    lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/vinil-180g-vale-a-pena`,           lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/como-avaliar-estado-disco-vinil`,  lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/toca-discos-para-iniciantes`,      lastModified: new Date("2026-07-10"), changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/pre-amplificador-phono`,           lastModified: new Date("2026-07-10"), changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/rock`,                              lastModified: ROCK_GUIDE_DATE,    changeFrequency: "monthly", priority: 0.8 },
      ...rockSubgenres.map((sg) => ({
        url: `${SITEMAP_BASE}/guias/rock/${sg.slug}`,
        lastModified: ROCK_GUIDE_DATE,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
      ...BEST_OF_ARTISTS.map((a) => ({
        url: `${SITEMAP_BASE}/guias/melhores-discos/${a.slug}`,
        lastModified: new Date("2026-07-14"),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
      ...[1960, 1970, 1980, 1990, 2000, 2010, 2020].map((d) => ({
        url: `${SITEMAP_BASE}/decada/${d}`,
        lastModified: latestUpdate,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  }

  if (id === "artistas") {
    try {
      return await getSitemapArtists();
    } catch {
      return [];
    }
  }

  if (id.startsWith("discos-")) {
    const shard = id.slice("discos-".length) as DiscoShard;
    if (!DISCO_SHARDS.includes(shard)) return [];
    try {
      return await getSitemapDiscosForShard(shard);
    } catch {
      return [];
    }
  }

  if (id === "estilos") {
    try {
      return await getSitemapEstilos();
    } catch {
      return [];
    }
  }

  if (id === "paises") {
    try {
      return await getSitemapPaises();
    } catch {
      return [];
    }
  }

  return [];
}
