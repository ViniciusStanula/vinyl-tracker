import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { slugifyArtist } from "@/lib/utils/slugify";
import { slugifyStyle } from "@/lib/utils/styleUtils";
import { unstable_cache } from "next/cache";
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/siteUrl";

export const SITEMAP_BASE = SITE_URL;

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
        AND  (format IS NULL OR format = 'vinyl')
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
            AND  (format IS NULL OR format = 'vinyl')
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

// Months in Portuguese and English for date-slug detection
const DATE_SLUG_RE =
  /^\d{1,2}-(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|feb|apr|may|aug|sep|oct)-\d{4}$/;

// Publisher/label/legal-entity keywords that appear in catalog metadata noise
const JUNK_TOKENS = new Set([
  "publishing", "publisher", "publications",
  "records", "recordings", "record",
  "label", "labels",
  "music", "musica", "musicas",
  "inc", "llc", "ltd", "ltda", "corp", "company",
  "distribution", "distribuidora",
  "entertainment",
  "management",
  "editora", "edicoes", "edicao",
]);

function isJunkArtistSlug(slug: string): boolean {
  if (DATE_SLUG_RE.test(slug)) return true;
  const tokens = slug.split("-");
  return tokens.some((t) => JUNK_TOKENS.has(t));
}

export async function getSitemapArtists(): Promise<MetadataRoute.Sitemap> {
  // Mirror the thin-content noindex gate in artista/[slug]/page.tsx:
  // isThin = total <= 2 && !bioShortPt  →  only include artists with >2 records
  // OR a bio (LEFT JOIN ArtistMeta). Using COUNT > 2 as a safe proxy avoids
  // a complex name-normalisation join; the 1-2-record+bio edge case is rare.
  const artistRows = await prisma.$queryRaw<{ artista: string }[]>`
    SELECT artista
    FROM   "Disco"
    WHERE  (format IS NULL OR format = 'vinyl')
      AND  price_count >= 5
    GROUP  BY artista
    HAVING COUNT(*) > 2
    ORDER  BY artista
  `;

  const seenSlugs = new Set<string>();
  const routes: MetadataRoute.Sitemap = [];
  let excluded = 0;

  for (const { artista } of artistRows) {
    const slug = slugifyArtist(artista);
    if (!slug || seenSlugs.has(slug)) continue;
    if (isJunkArtistSlug(slug)) {
      excluded++;
      continue;
    }
    seenSlugs.add(slug);
    routes.push({ url: `${SITEMAP_BASE}/artista/${slug}`, lastModified: new Date() });
  }

  if (excluded > 0) {
    // eslint-disable-next-line no-console
    console.info("[sitemap/artistas] excluded %d junk artist slugs", excluded);
  }

  return routes;
}

// Disco sitemap shards: a–z, "09" for digits, "other" for everything else.
// Each shard covers slugs whose first character matches the group.
export const DISCO_SHARD_LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
export const DISCO_SHARDS = [...DISCO_SHARD_LETTERS, "09", "other"] as const;
export type DiscoShard = (typeof DISCO_SHARDS)[number];

export async function getSitemapDiscosForShard(shard: DiscoShard): Promise<MetadataRoute.Sitemap> {
  let discos: { slug: string; updatedAt: Date }[];

  if (shard === "other") {
    discos = await prisma.$queryRaw<{ slug: string; updatedAt: Date }[]>`
      SELECT slug, "updatedAt"
      FROM "Disco"
      WHERE (format IS NULL OR format = 'vinyl') AND price_count >= 5 AND LEFT(slug, 1) !~ '[a-z0-9]'
    `;
  } else if (shard === "09") {
    discos = await prisma.$queryRaw<{ slug: string; updatedAt: Date }[]>`
      SELECT slug, "updatedAt"
      FROM "Disco"
      WHERE (format IS NULL OR format = 'vinyl') AND price_count >= 5 AND LEFT(slug, 1) ~ '[0-9]'
    `;
  } else {
    discos = await prisma.$queryRaw<{ slug: string; updatedAt: Date }[]>`
      SELECT slug, "updatedAt"
      FROM "Disco"
      WHERE (format IS NULL OR format = 'vinyl') AND price_count >= 5 AND LEFT(slug, 1) = ${shard}
    `;
  }

  return discos.map((d) => ({
    url:          `${SITEMAP_BASE}/disco/${d.slug}`,
    lastModified: d.updatedAt,
  }));
}

export async function getSitemapEstilos(): Promise<MetadataRoute.Sitemap> {
  // Mirror the thin-content noindex gate in estilo/[slug]/page.tsx:
  // isThin = n <= 3 && !bioShortPt  →  only include tags with >3 records.
  const rows = await prisma.$queryRaw<{ tag: string }[]>`
    SELECT tag
    FROM (
      SELECT unnest(string_to_array(lastfm_tags, ', ')) AS tag
      FROM "Disco"
      WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
        AND disponivel = TRUE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
    ) t
    GROUP BY tag
    HAVING COUNT(*) > 3
  `;

  const seenSlugs = new Set<string>();
  const routes: MetadataRoute.Sitemap = [];

  for (const { tag } of rows) {
    const slug = slugifyStyle(tag);
    if (!slug || seenSlugs.has(slug)) continue;
    seenSlugs.add(slug);
    routes.push({ url: `${SITEMAP_BASE}/estilo/${slug}`, lastModified: new Date() });
  }

  return routes;
}
