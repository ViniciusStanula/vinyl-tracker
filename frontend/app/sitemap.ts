import type { MetadataRoute } from "next";
import { SITEMAP_BASE, getSitemapArtists, getSitemapDiscos, getSitemapEstilos } from "@/lib/db/sitemap";

export const revalidate = 86400;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
} // regenerate every 24 hours — sitemap staleness is fine for SEO

export async function generateSitemaps() {
  return [{ id: "estatico" }, { id: "artistas" }, { id: "discos" }, { id: "estilos" }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  if (id === "estatico") {
    return [
      { url: SITEMAP_BASE,                                    changeFrequency: "daily",   priority: 1.0 },
      { url: `${SITEMAP_BASE}/disco`,                         changeFrequency: "daily",   priority: 0.9 },
      { url: `${SITEMAP_BASE}/discos-abaixo-de-200`,          changeFrequency: "daily",   priority: 0.8 },
      { url: `${SITEMAP_BASE}/artistas-mais-ouvidos`,         changeFrequency: "daily",   priority: 0.7 },
      { url: `${SITEMAP_BASE}/sobre`,                         changeFrequency: "monthly", priority: 0.3 },
    ];
  }

  if (id === "artistas") {
    try {
      return shuffle(await getSitemapArtists());
    } catch {
      return [];
    }
  }

  if (id === "discos") {
    try {
      return shuffle(await getSitemapDiscos());
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
