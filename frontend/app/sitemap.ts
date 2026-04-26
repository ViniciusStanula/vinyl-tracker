import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { slugifyArtist } from "@/lib/slugify";
import { slugifyStyle } from "@/lib/styleUtils";

export const revalidate = 86400; // regenerate every 24 hours — sitemap staleness is fine for SEO

const base =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

export async function generateSitemaps() {
  return [{ id: "estatico" }, { id: "artistas" }, { id: "discos" }, { id: "estilos" }];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  if (id === "estatico") {
    return [
      { url: base,              changeFrequency: "daily",  priority: 1.0 },
      { url: `${base}/disco`,   changeFrequency: "daily",  priority: 0.9 },
      { url: `${base}/sobre`,   changeFrequency: "monthly", priority: 0.3 },
    ];
  }

  if (id === "artistas") {
    try {
      const artistRows = await prisma.disco.findMany({
        select: { artista: true },
        distinct: ["artista"],
      });

      const seenSlugs = new Set<string>();
      const routes: MetadataRoute.Sitemap = [];

      for (const { artista } of artistRows) {
        const slug = slugifyArtist(artista);
        if (!slug || seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        routes.push({
          url: `${base}/artista/${slug}`,
          changeFrequency: "weekly",
          priority: 0.6,
        });
      }

      return routes;
    } catch {
      return [];
    }
  }

  if (id === "discos") {
    try {
      const discos = await prisma.disco.findMany({
        select: { slug: true, updatedAt: true },
      });

      return discos.map((d) => ({
        url: `${base}/disco/${d.slug}`,
        lastModified: d.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      }));
    } catch {
      return [];
    }
  }

  if (id === "estilos") {
    try {
      const rows = await prisma.$queryRaw<{ tag: string }[]>`
        SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
      `;

      const seenSlugs = new Set<string>();
      const routes: MetadataRoute.Sitemap = [];

      for (const { tag } of rows) {
        const slug = slugifyStyle(tag);
        if (!slug || seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        routes.push({
          url: `${base}/estilo/${slug}`,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }

      return routes;
    } catch {
      return [];
    }
  }

  return [];
}
