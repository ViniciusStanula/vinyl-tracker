import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { slugifyArtist } from "@/lib/utils/slugify";
import { slugifyStyle } from "@/lib/utils/styleUtils";
import { REDIRECTED_ESTILO_SLUGS } from "@/lib/db/estilo";
import { PAIS_PT, ISO2_TO_SLUG, COUNTRY_TAG_TO_PAIS_SLUG } from "@/lib/paises";
import { unstable_cache } from "next/cache";
import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/siteUrl";

export const SITEMAP_BASE = SITE_URL;

// Must match the translate() expression in estilo/[slug]/page.tsx
const ACCENT_FROM = Prisma.raw(`'áàâãäåéèêëíìîïóòôõöúùûüçñý'`);
const ACCENT_TO   = Prisma.raw(`'aaaaaaeeeeiiiiooooouuuucny'`);

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
      prisma.$queryRaw<{ slug: string; nome: string; cnt: bigint }[]>`
        WITH tags AS (
          SELECT unnest(string_to_array(lastfm_tags, ', ')) AS tag
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
        SELECT slug, min(tag) AS nome, COUNT(*) AS cnt
        FROM   slugged
        WHERE  slug != ''
        GROUP  BY slug
        HAVING COUNT(*) > 3
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

    const styles = styleRows
      .filter(({ slug }) => !REDIRECTED_ESTILO_SLUGS.has(slug) && !COUNTRY_TAG_TO_PAIS_SLUG[slug])
      .map(({ slug, nome }) => ({ slug, nome }));

    return { artists, styles };
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

export const getLatestDiscoUpdate = unstable_cache(
  async (): Promise<Date> => {
    const rows = await prisma.$queryRaw<[{ maxUpdatedAt: Date }]>`
      SELECT MAX("updatedAt") AS "maxUpdatedAt" FROM "Disco"
      WHERE (format IS NULL OR format = 'vinyl')
    `;
    return rows[0]?.maxUpdatedAt ?? new Date();
  },
  ["latest-disco-update"],
  { tags: ["prices"], revalidate: 3600 },
);

export async function getSitemapArtists(): Promise<MetadataRoute.Sitemap> {
  // Mirror the thin-content noindex gate in artista/[slug]/page.tsx:
  // isThin = total <= 2 && !bioShortPt → include artists with >2 records
  // OR with a bio (even if ≤2 records). LEFT JOIN ArtistMeta checks bio_short_pt.
  // disponivel = TRUE: artists whose entire catalog is unavailable would pass
  // HAVING but their page gets noindexed — skip them here to keep sitemap clean.
  const artistRows = await prisma.$queryRaw<{ artista: string; lastUpdated: Date }[]>`
    SELECT d.artista, MAX(d."updatedAt") AS "lastUpdated"
    FROM   "Disco" d
    LEFT JOIN "ArtistMeta" am ON am.artista = d.artista
    WHERE  (d.format IS NULL OR d.format = 'vinyl')
      AND  d.price_count >= 5
      AND  d.disponivel = TRUE
    GROUP  BY d.artista
    HAVING COUNT(*) > 2
        OR MAX(CASE WHEN am.bio_short_pt IS NOT NULL AND am.bio_short_pt != '' THEN 1 ELSE 0 END) = 1
    ORDER  BY d.artista
  `;

  const seenSlugs = new Set<string>();
  const routes: MetadataRoute.Sitemap = [];
  let excluded = 0;

  for (const row of artistRows) {
    const slug = slugifyArtist(row.artista);
    if (!slug || seenSlugs.has(slug)) continue;
    if (isJunkArtistSlug(slug)) {
      excluded++;
      continue;
    }
    seenSlugs.add(slug);
    routes.push({ url: `${SITEMAP_BASE}/artista/${slug}`, lastModified: row.lastUpdated });
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
      WHERE (format IS NULL OR format = 'vinyl') AND price_count >= 5 AND disponivel = TRUE AND LEFT(slug, 1) !~ '[a-z0-9]'
      ORDER BY slug
    `;
  } else if (shard === "09") {
    discos = await prisma.$queryRaw<{ slug: string; updatedAt: Date }[]>`
      SELECT slug, "updatedAt"
      FROM "Disco"
      WHERE (format IS NULL OR format = 'vinyl') AND price_count >= 5 AND disponivel = TRUE AND LEFT(slug, 1) ~ '[0-9]'
      ORDER BY slug
    `;
  } else {
    discos = await prisma.$queryRaw<{ slug: string; updatedAt: Date }[]>`
      SELECT slug, "updatedAt"
      FROM "Disco"
      WHERE (format IS NULL OR format = 'vinyl') AND price_count >= 5 AND disponivel = TRUE AND LEFT(slug, 1) = ${shard}
      ORDER BY slug
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
  const rows = await prisma.$queryRaw<{ tag: string; lastUpdated: Date }[]>`
    SELECT tag, MAX("updatedAt") AS "lastUpdated"
    FROM (
      SELECT unnest(string_to_array(lastfm_tags, ', ')) AS tag, "updatedAt"
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

  for (const row of rows) {
    const slug = slugifyStyle(row.tag);
    if (!slug || seenSlugs.has(slug) || REDIRECTED_ESTILO_SLUGS.has(slug) || COUNTRY_TAG_TO_PAIS_SLUG[slug]) continue;
    seenSlugs.add(slug);
    routes.push({ url: `${SITEMAP_BASE}/estilo/${slug}`, lastModified: row.lastUpdated });
  }

  return routes;
}

export async function getSitemapPaises(): Promise<MetadataRoute.Sitemap> {
  // Mirror the thin-content noindex gate in pais/[slug]/page.tsx (noindex when
  // total <= 3): only include countries with >3 records and a known PT name.
  const rows = await prisma.$queryRaw<{ country: string; lastUpdated: Date }[]>`
    SELECT am.country, MAX(c."updatedAt") AS "lastUpdated"
    FROM "Disco" c
    INNER JOIN "ArtistMeta" am ON am.artista = c.artista
    WHERE am.country IS NOT NULL
      AND c.disponivel = TRUE
      AND (c.format IS NULL OR c.format = 'vinyl')
      AND c.price_count >= 5
    GROUP BY am.country
    HAVING COUNT(*) > 3
  `;

  const routes: MetadataRoute.Sitemap = [];
  for (const row of rows) {
    const slug = ISO2_TO_SLUG[row.country];
    if (!PAIS_PT[row.country] || !slug) continue;
    routes.push({ url: `${SITEMAP_BASE}/pais/${slug}`, lastModified: row.lastUpdated });
  }
  return routes;
}
