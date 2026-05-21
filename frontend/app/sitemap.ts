import type { MetadataRoute } from "next";
import {
  SITEMAP_BASE,
  getSitemapArtists,
  getSitemapDiscosForShard,
  getSitemapEstilos,
  DISCO_SHARDS,
  type DiscoShard,
} from "@/lib/db/sitemap";

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
    return [
      { url: SITEMAP_BASE },
      { url: `${SITEMAP_BASE}/disco` },
      { url: `${SITEMAP_BASE}/discos-abaixo-de-200` },
      { url: `${SITEMAP_BASE}/artistas-mais-ouvidos` },
      { url: `${SITEMAP_BASE}/sobre` },
      { url: `${SITEMAP_BASE}/guias` },
      { url: `${SITEMAP_BASE}/guias/top-artistas-spotify` },
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
