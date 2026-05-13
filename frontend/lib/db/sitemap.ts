import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { slugifyArtist } from "@/lib/utils/slugify";
import { slugifyStyle } from "@/lib/utils/styleUtils";
import { unstable_cache } from "next/cache";
import type { MetadataRoute } from "next";

export const SITEMAP_BASE =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinyl-tracker.vercel.app";

// Must match the translate() expression in estilo/[slug]/page.tsx
const ACCENT_FROM = Prisma.raw(`'áàâãäåéèêëíìîïóòôõöúùûüçñý'`);
const ACCENT_TO   = Prisma.raw(`'aaaaaaeeeeiiiioooouuuucny'`);

export type SitemapPageData = {
  artists: { nome: string; slug: string }[];
  styles:  { slug: string; nome: string }[];
};

export const getSitemapData = unstable_cache(
  async (): Promise<SitemapPageData> => {
    const [artistaRows, styleRows] = await Promise.all([
      prisma.$queryRaw<{ artista: string }[]>`
        SELECT DISTINCT artista
        FROM   "Disco"
        WHERE  disponivel = TRUE
          AND  price_count >= 5
        ORDER  BY artista
      `,
      prisma.$queryRaw<{ slug: string; nome: string }[]>`
        WITH tags AS (
          SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
          FROM   "Disco"
          WHERE  lastfm_tags IS NOT NULL
            AND  lastfm_tags != ''
            AND  disponivel = TRUE
            AND  price_count >= 5
        ),
        slugged AS (
          SELECT
            tag,
            regexp_replace(
              regexp_replace(
                translate(lower(tag), ${ACCENT_FROM}, ${ACCENT_TO}),
                '[^a-z0-9]+', '-', 'g'
              ),
              '^-+|-+$', '', 'g'
            ) AS slug
          FROM tags
        )
        SELECT slug, min(tag) AS nome
        FROM   slugged
        WHERE  slug != ''
        GROUP  BY slug
        ORDER  BY slug
      `,
    ]);

    const seenSlug = new Set<string>();
    const artists: { nome: string; slug: string }[] = [];
    for (const { artista } of artistaRows) {
      const slug = slugifyArtist(artista);
      if (!slug || seenSlug.has(slug)) continue;
      seenSlug.add(slug);
      artists.push({ nome: artista, slug });
    }

    return {
      artists,
      styles: styleRows.map(({ slug, nome }) => ({ slug, nome })),
    };
  },
  ["sitemap-page"],
  { tags: ["prices"], revalidate: 3600 },
);

export async function getSitemapArtists(): Promise<MetadataRoute.Sitemap> {
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
    routes.push({ url: `${SITEMAP_BASE}/artista/${slug}`, changeFrequency: "weekly", priority: 0.6 });
  }

  return routes;
}

export async function getSitemapDiscos(): Promise<MetadataRoute.Sitemap> {
  const discos = await prisma.disco.findMany({
    select: { slug: true, updatedAt: true },
  });

  return discos.map((d) => ({
    url:             `${SITEMAP_BASE}/disco/${d.slug}`,
    lastModified:    d.updatedAt,
    changeFrequency: "daily" as const,
    priority:        0.8,
  }));
}

export async function getSitemapEstilos(): Promise<MetadataRoute.Sitemap> {
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
    routes.push({ url: `${SITEMAP_BASE}/estilo/${slug}`, changeFrequency: "weekly", priority: 0.5 });
  }

  return routes;
}
