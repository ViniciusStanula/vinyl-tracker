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
import { DECADES } from "@/lib/decadas";
import { getCoresList } from "@/lib/db/vinilColorido";
import { getEdicoesList } from "@/lib/db/edicaoVinil";
import { getEstiloDecadaCells, ESTILO_DECADA_SITEMAP_LIMIT } from "@/lib/db/estiloDecada";
import { getGravadorasList, GRAVADORA_SITEMAP_LIMIT } from "@/lib/db/gravadora";

export const revalidate = 86400; // regenerate every 24 hours — sitemap staleness is fine for SEO

export async function generateSitemaps() {
  const discoShards = DISCO_SHARDS.map((shard) => ({ id: `discos-${shard}` }));
  return [
    { id: "estatico" },
    { id: "artistas" },
    ...discoShards,
    { id: "estilos" },
    { id: "paises" },
    { id: "cores" },
    { id: "edicoes" },
    { id: "estilos-decadas" },
    { id: "gravadoras" },
  ];
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
      { url: `${SITEMAP_BASE}/decadas`,                                 lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
      { url: `${SITEMAP_BASE}/vinil-colorido`,                          lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
      { url: `${SITEMAP_BASE}/edicao`,                                  lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
      { url: `${SITEMAP_BASE}/gravadoras`,                              lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.6 },
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
      { url: `${SITEMAP_BASE}/sitemap`,                                 lastModified: latestUpdate,       changeFrequency: "weekly",  priority: 0.3 },
      { url: `${SITEMAP_BASE}/politica-de-privacidade`,                 lastModified: new Date("2026-01-01"), changeFrequency: "yearly", priority: 0.2 },
      { url: `${SITEMAP_BASE}/termos-de-uso`,                           lastModified: new Date("2026-01-01"), changeFrequency: "yearly", priority: 0.2 },
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
      ...DECADES.map((d) => ({
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

  // getCoresList / getEdicoesList already drop anything at or below the
  // 3-record noindex threshold, so these shards never list a noindexed URL.
  if (id === "cores") {
    try {
      const cores = await getCoresList();
      return cores.map((c) => ({
        url: `${SITEMAP_BASE}/vinil-colorido/${c.slug}`,
        lastModified: c.lastUpdated,
      }));
    } catch {
      return [];
    }
  }

  // Label pages, biggest first, capped to the batch being rolled out.
  // getGravadorasList only returns labels at or above the noindex threshold.
  if (id === "gravadoras") {
    try {
      const [gravadoras, latestUpdate] = await Promise.all([getGravadorasList(), getLatestDiscoUpdate()]);
      return gravadoras.slice(0, GRAVADORA_SITEMAP_LIMIT).map((g) => ({
        url: `${SITEMAP_BASE}/gravadora/${g.slug}`,
        lastModified: latestUpdate,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));
    } catch {
      return [];
    }
  }

  // Genre × decade cells, biggest first, capped to the batch currently being
  // rolled out (ESTILO_DECADA_SITEMAP_LIMIT). getEstiloDecadaCells already
  // drops anything below the noindex threshold, so no cell listed here is a
  // page that tells crawlers not to index it.
  if (id === "estilos-decadas") {
    try {
      const [cells, latestUpdate] = await Promise.all([getEstiloDecadaCells(), getLatestDiscoUpdate()]);
      return cells.slice(0, ESTILO_DECADA_SITEMAP_LIMIT).map((c) => ({
        url: `${SITEMAP_BASE}/estilo/${c.slug}/${c.decada}`,
        lastModified: latestUpdate,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      }));
    } catch {
      return [];
    }
  }

  if (id === "edicoes") {
    try {
      const edicoes = await getEdicoesList();
      return edicoes.map((e) => ({
        url: `${SITEMAP_BASE}/edicao/${e.slug}`,
        lastModified: e.lastUpdated,
      }));
    } catch {
      return [];
    }
  }

  return [];
}
