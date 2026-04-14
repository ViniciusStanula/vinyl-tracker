import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { slugifyArtist } from "@/lib/slugify";

export const revalidate = 21600; // regenerate every 6 hours

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

  // Static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "daily", priority: 1 },
  ];

  // All disco pages
  const discos = await prisma.disco.findMany({
    select: { slug: true, updatedAt: true },
  });

  const discoRoutes: MetadataRoute.Sitemap = discos.map((d) => ({
    url: `${base}/disco/${d.slug}`,
    lastModified: d.updatedAt,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Distinct artist pages (deduplicated via slugifyArtist)
  const artistRows = await prisma.disco.findMany({
    select: { artista: true },
    distinct: ["artista"],
  });

  const seenSlugs = new Set<string>();
  const artistRoutes: MetadataRoute.Sitemap = [];

  for (const { artista } of artistRows) {
    const slug = slugifyArtist(artista);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    artistRoutes.push({
      url: `${base}/artista/${slug}`,
      changeFrequency: "weekly",
      priority: 0.6,
    });
  }

  return [...staticRoutes, ...discoRoutes, ...artistRoutes];
}
