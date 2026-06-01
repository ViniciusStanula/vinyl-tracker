import type { MetadataRoute } from "next";
import {
  SITEMAP_BASE,
  getSitemapArtists,
  getSitemapDiscosForShard,
  getSitemapEstilos,
  DISCO_SHARDS,
  type DiscoShard,
} from "@/lib/db/sitemap";
import { getRockSubgenres } from "@/lib/guias/rock-data";

export const revalidate = 86400;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
} // regenerate every 24 hours — sitemap staleness is fine for SEO

export async function generateSitemaps() {
  const discoShards = DISCO_SHARDS.map((shard) => ({ id: `discos-${shard}` }));
  return [{ id: "estatico" }, { id: "artistas" }, ...discoShards, { id: "estilos" }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  if (id === "estatico") {
    const rockSubgenres = getRockSubgenres();
    const now = new Date();
    return [
      { url: SITEMAP_BASE, lastModified: now, changeFrequency: "daily", priority: 1.0 },
      { url: `${SITEMAP_BASE}/disco`, changeFrequency: "daily", priority: 0.8 },
      { url: `${SITEMAP_BASE}/discos-abaixo-de-200`, changeFrequency: "daily", priority: 0.7 },
      { url: `${SITEMAP_BASE}/artistas-mais-ouvidos`, changeFrequency: "weekly", priority: 0.6 },
      { url: `${SITEMAP_BASE}/sobre`, changeFrequency: "monthly", priority: 0.4 },
      { url: `${SITEMAP_BASE}/guias`, changeFrequency: "weekly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/top-artistas-spotify`, changeFrequency: "daily", priority: 0.7 },
      { url: `${SITEMAP_BASE}/guias/como-cuidar-de-discos-de-vinil`, changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/vinil-colorido-e-picture-disc`, changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/vinil-180g-vale-a-pena`, changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/como-avaliar-estado-disco-vinil`, changeFrequency: "monthly", priority: 0.8 },
      { url: `${SITEMAP_BASE}/guias/rock`, changeFrequency: "monthly", priority: 0.8 },
      ...rockSubgenres.map((sg) => ({
        url: `${SITEMAP_BASE}/guias/rock/${sg.slug}`,
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
    ];
  }

  if (id === "artistas") {
    try {
      return shuffle(await getSitemapArtists());
    } catch {
      return [];
    }
  }

  if (id.startsWith("discos-")) {
    const shard = id.slice("discos-".length) as DiscoShard;
    if (!DISCO_SHARDS.includes(shard)) return [];
    try {
      return shuffle(await getSitemapDiscosForShard(shard));
    } catch {
      return [];
    }
  }

  if (id === "estilos") {
    try {
      return shuffle(await getSitemapEstilos());
    } catch {
      return [];
    }
  }

  return [];
}
