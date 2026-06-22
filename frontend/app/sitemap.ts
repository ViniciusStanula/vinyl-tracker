import type { MetadataRoute } from "next";
import {
  SITEMAP_BASE,
  getSitemapArtists,
  getSitemapDiscosForShard,
  getSitemapEstilos,
  getLatestDiscoUpdate,
  DISCO_SHARDS,
  type DiscoShard,
} from "@/lib/db/sitemap";
import { getRockSubgenres } from "@/lib/guias/rock-data";

export const revalidate = 86400; // regenerate every 24 hours — sitemap staleness is fine for SEO

export async function generateSitemaps() {
  const discoShards = DISCO_SHARDS.map((shard) => ({ id: `discos-${shard}` }));
  return [{ id: "estatico" }, { id: "artistas" }, ...discoShards, { id: "estilos" }];
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
    const ARTICLES_MODIFIED = new Date("2026-06-09");
    const ROCK_GUIDE_DATE   = new Date("2026-05-26");
    return [
      { url: SITEMAP_BASE,                                              lastModified: latestUpdate,       changeFrequency: "daily",   priority: 1.0 },
      { url: `${SITEMAP_BASE}/disco`,                                   lastModified: latestUpdate,       changeFrequency: "daily",   priority: 0.8 },
      { url: `${SITEMAP_BASE}/discos-abaixo-de-200`,                    lastModified: latestUpdate,       changeFrequency: "daily",   priority: 0.7 },
      { url: `${SITEMAP_BASE}/artistas-mais-ouvidos`,                   lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
      { url: `${SITEMAP_BASE}/estilos`,                                 lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.7 },
      { url: `${SITEMAP_BASE}/sobre` },
      { url: `${SITEMAP_BASE}/guias`,                                   lastModified: ARTICLES_MODIFIED,  changeFrequency: "weekly",  priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/top-artistas-spotify`,              lastModified: latestUpdate,       changeFrequency: "daily",   priority: 0.7 },
      { url: `${SITEMAP_BASE}/guias/como-cuidar-de-discos-de-vinil`,   lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/vinil-colorido-e-picture-disc`,    lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/vinil-180g-vale-a-pena`,           lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/como-avaliar-estado-disco-vinil`,  lastModified: ARTICLES_MODIFIED,  changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/rock`,                              lastModified: ROCK_GUIDE_DATE,    changeFrequency: "monthly", priority: 0.8 },
      ...rockSubgenres.map((sg) => ({
        url: `${SITEMAP_BASE}/guias/rock/${sg.slug}`,
        lastModified: ROCK_GUIDE_DATE,
        changeFrequency: "monthly" as const,
        priority: 0.7,
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

  return [];
}
