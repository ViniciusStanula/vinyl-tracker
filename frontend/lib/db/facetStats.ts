import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { slugifyArtist } from "@/lib/utils/slugify";
import { slugifyStyle } from "@/lib/utils/styleUtils";
import { resolveColorSlug } from "./vinilColorido";
import { resolveEditionSlug } from "./edicaoVinil";
import { SLUG_TO_ISO2 } from "@/lib/paises";

/**
 * Aggregate facts about one facet listing, for the intro paragraph the facet
 * pages render above their grid.
 *
 * The listing itself is capped at the top 240 records by discount, so the
 * fetched rows can't answer "what does this facet look like as a whole" —
 * a page whose grid opens on five 2020s reissues can still be a facet whose
 * catalogue is mostly 1970s. These stats are computed over every record in
 * the facet, which is what makes the paragraph say something the grid
 * doesn't already show.
 */
export type FacetStats = {
  total: number;
  anoMin: number | null;
  anoMax: number | null;
  precoMin: number | null;
  precoMediana: number | null;
  precoMax: number | null;
  emOferta: number;
  decadaTop: { decada: number; count: number } | null;
  topArtistas: { artista: string; slug: string; count: number }[];
  topEstilos: { tag: string; slug: string; count: number }[];
};

export type FacetKind = "decada" | "edicao" | "cor" | "pais" | "estilo-decada" | "gravadora";

// Same year reconciliation the decade filter uses (queryDiscos.ts): the
// EARLIER of MusicBrainz and the Discogs master, because MB routinely matched
// a reissue release-group and would date a 1972 album to 2013.
const ANO = Prisma.sql`LEAST(
  NULLIF(substring(c.mb_first_release_date from '^[0-9]{4}'), '')::int,
  c.discogs_master_year
)`;

/** The extra join and the facet predicate, mirroring the fragments the facet's
 *  own page query uses. Null when the key isn't a real facet value.
 *  Kept apart so the caller can splice its price LATERAL between them. */
function facetSource(
  kind: FacetKind,
  key: string,
): { join: Prisma.Sql; where: Prisma.Sql } | null {
  const noJoin = Prisma.empty;

  if (kind === "decada") {
    const decada = Number(key);
    if (!Number.isInteger(decada)) return null;
    return { join: noJoin, where: Prisma.sql`${ANO} BETWEEN ${decada} AND ${decada + 9}` };
  }

  if (kind === "edicao") {
    const label = resolveEditionSlug(key);
    if (!label) return null;
    return { join: noJoin, where: Prisma.sql`c.vinil_edicao = ${label}` };
  }

  if (kind === "gravadora") {
    // Key is the resolved label name, already stripped of the Discogs
    // disambiguation suffix by getGravadoraData — matched the same way here so
    // the stats count exactly the rows the grid lists.
    return {
      join: noJoin,
      where: Prisma.sql`
        BTRIM(regexp_replace(
          NULLIF(BTRIM(COALESCE(NULLIF(c.discogs_label, ''), c.mb_label)), ''),
          '\\s*\\([0-9]+\\)$', ''
        )) = ${key}
      `,
    };
  }

  if (kind === "estilo-decada") {
    // Key is "<canonical tag>|<decade>". The caller already resolved the slug
    // to its canonical tag, so this stays a pure string split — the cache key
    // has to be plain strings, and a DB lookup here would be a second round
    // trip for something the page has in hand.
    const sep = key.lastIndexOf("|");
    if (sep < 1) return null;
    const canonical = key.slice(0, sep);
    const decada = Number(key.slice(sep + 1));
    if (!Number.isInteger(decada)) return null;
    return {
      join: noJoin,
      where: Prisma.sql`
        (LOWER(${canonical}) = ANY(string_to_array(LOWER(c.lastfm_tags), ', '))
          OR LOWER(${canonical}) = ANY(string_to_array(LOWER(c.discogs_styles), ', ')))
        AND ${ANO} BETWEEN ${decada} AND ${decada + 9}
      `,
    };
  }

  if (kind === "cor") {
    const resolved = resolveColorSlug(key);
    if (!resolved) return null;
    // Exact for the three simplified labels, substring for single colors, so
    // compound values like "Azul / Rosa" still count under "azul" — same rule
    // as getVinilColoridoPageData.
    return {
      join: noJoin,
      where: resolved.exact
        ? Prisma.sql`c.vinil_cor = ${resolved.label}`
        : Prisma.sql`c.vinil_cor ILIKE ${"%" + resolved.label + "%"}`,
    };
  }

  const iso2 = SLUG_TO_ISO2[key];
  if (!iso2) return null;
  return {
    join: Prisma.sql`INNER JOIN "ArtistMeta" am ON am.artista = c.artista`,
    where: Prisma.sql`am.country = ${iso2}`,
  };
}

type StatsRow = {
  total: bigint;
  ano_min: number | null;
  ano_max: number | null;
  preco_min: number | null;
  preco_mediana: number | null;
  preco_max: number | null;
  em_oferta: bigint;
  decada_top: { decada: number; n: number }[] | null;
  top_artistas: { artista: string; n: number }[] | null;
  top_estilos: { tag: string; n: number }[] | null;
};

const _getFacetStats = unstable_cache(
  async (kind: FacetKind, key: string): Promise<FacetStats | null> => {
    const source = facetSource(kind, key);
    if (!source) return null;

    // One round trip. `base` is referenced by every sub-select below, so
    // Postgres materializes it once and the facet is scanned a single time.
    const rows = await prisma.$queryRaw<StatsRow[]>`
      WITH base AS (
        SELECT
          c.id,
          c.artista,
          ${ANO} AS ano,
          hp_latest.preco,
          c.avg_30d::float AS avg30,
          c.lastfm_tags,
          c.discogs_styles
        FROM "Disco" c
        ${source.join}
        INNER JOIN LATERAL (
          SELECT "precoBrl"::float AS preco
          FROM "HistoricoPreco"
          WHERE "discoId" = c.id
          ORDER BY "capturadoEm" DESC LIMIT 1
        ) hp_latest ON true
        WHERE c.disponivel = TRUE
          AND (c.format IS NULL OR c.format = 'vinyl')
          AND c.price_count >= 5
          AND ${source.where}
      ),
      tags AS (
        SELECT id, LOWER(BTRIM(t)) AS tag
        FROM base, unnest(string_to_array(lastfm_tags, ', ')) AS t
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags <> ''
        UNION
        SELECT id, LOWER(BTRIM(t))
        FROM base, unnest(string_to_array(discogs_styles, ', ')) AS t
        WHERE discogs_styles IS NOT NULL AND discogs_styles <> ''
      )
      SELECT
        (SELECT COUNT(*) FROM base) AS total,
        (SELECT MIN(ano) FROM base) AS ano_min,
        (SELECT MAX(ano) FROM base) AS ano_max,
        (SELECT MIN(preco) FROM base) AS preco_min,
        (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY preco) FROM base) AS preco_mediana,
        (SELECT MAX(preco) FROM base) AS preco_max,
        (SELECT COUNT(*) FROM base WHERE avg30 > 0 AND preco < avg30) AS em_oferta,
        (SELECT json_agg(d) FROM (
           SELECT (ano / 10) * 10 AS decada, COUNT(*)::int AS n
           FROM base WHERE ano BETWEEN 1900 AND 2100
           GROUP BY 1 ORDER BY n DESC, decada LIMIT 1
         ) d) AS decada_top,
        (SELECT json_agg(a) FROM (
           -- Same exclusions as the /artistas mosaic (isCompilationArtist):
           -- "Various Artists" has the deepest catalogue by far and would
           -- headline half the facets, and the unknown-artist bucket is a
           -- noindex page — neither is worth an internal link.
           SELECT artista, COUNT(*)::int AS n
           FROM base
           WHERE artista IS NOT NULL AND artista <> ''
             AND artista NOT ILIKE '%various%'
             AND artista NOT ILIKE '%identificad%'
             AND LOWER(BTRIM(artista)) NOT IN ('por', 'disco de vinil')
           GROUP BY 1 ORDER BY n DESC, artista LIMIT 5
         ) a) AS top_artistas,
        (SELECT json_agg(e) FROM (
           SELECT tag, COUNT(DISTINCT id)::int AS n
           FROM tags WHERE tag <> ''
           GROUP BY 1 ORDER BY n DESC, tag LIMIT 4
         ) e) AS top_estilos
    `;

    const r = rows[0];
    if (!r || Number(r.total) === 0) return null;

    return {
      total: Number(r.total),
      anoMin: r.ano_min,
      anoMax: r.ano_max,
      precoMin: r.preco_min !== null ? Number(r.preco_min) : null,
      precoMediana: r.preco_mediana !== null ? Number(r.preco_mediana) : null,
      precoMax: r.preco_max !== null ? Number(r.preco_max) : null,
      emOferta: Number(r.em_oferta),
      decadaTop: r.decada_top?.[0]
        ? { decada: r.decada_top[0].decada, count: r.decada_top[0].n }
        : null,
      topArtistas: (r.top_artistas ?? []).map((a) => ({
        artista: a.artista,
        slug: slugifyArtist(a.artista),
        count: a.n,
      })),
      topEstilos: (r.top_estilos ?? []).map((e) => ({
        tag: e.tag,
        slug: slugifyStyle(e.tag),
        count: e.n,
      })),
    };
  },
  ["facet-stats"],
  { tags: ["prices"], revalidate: 14400 },
);

export const getFacetStats = cache(_getFacetStats);
