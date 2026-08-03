import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { slugifyStyle } from "@/lib/utils/styleUtils";
import { slugifyArtist } from "@/lib/utils/slugify";
import { COUNTRY_TAG_TO_PAIS_SLUG } from "@/lib/paises";

// Same accent-normalization constants as the artist page SQL slug matching
const ACCENT_FROM = "áàâãäåéèêëíìîïóòôõöúùûüçñý";
const ACCENT_TO   = "aaaaaaeeeeiiiiooooouuuucny";

const ESTILO_PAGE_SIZE = 60;

// Display-name overrides for style tags whose English form doesn't match how
// Brazilian users actually search (e.g. "soundtrack" vs. "trilha sonora").
// URL slugs stay in English (/estilo/soundtrack, /estilo/game) to avoid
// breaking already-indexed links — only the on-page title/H1/meta text changes.
const ESTILO_DISPLAY_PT: Record<string, string> = {
  soundtrack: "Trilha Sonora",
  game: "Trilha Sonora de Jogos",
  movie: "Trilha Sonora de Filme",
  anime: "Trilha Sonora de Anime",
};

export function getEstiloDisplayName(canonical: string): string {
  const override = ESTILO_DISPLAY_PT[canonical.toLowerCase()];
  if (override) return override;
  return canonical.replace(/\b\w/g, (c) => c.toUpperCase());
}

// Estilo slugs that are redirected elsewhere (next.config.ts) and must not be
// surfaced by any /estilo/ listing surface: thin/duplicate tags merged into a
// broader genre, and lastfm tags that are actually artist names, not genres.
export const REDIRECTED_ESTILO_SLUGS = new Set([
  // merged into /estilo/game — no unique inventory of their own
  "valve",
  "video-game-music",
  "game-remixes",
  // merged into /estilo/soundtrack — "ost" is just an abbreviation of it
  "ost",
  // artist names, not genres — redirected to /artista/<slug>
  "eric-church",
  "shania-twain",
  "kenny-rogers",
  "tim-mcgraw",
  "blake-shelton",
  "george-strait",
  "alan-jackson",
  "randy-travis",
  "miranda-lambert",
  "keith-urban",
  "toby-keith",
  "reba-mcentire",
  "kenny-chesney",
  "celine-dion",
  "britney-spears",
  "ariana-grande",
  "andrea-bocelli",
  "bts",
  "hannah-montana",
  "one-direction",
  "mike-patton",
  "within-temptation",
  "sheena-easton",
  "belchior",
  "fagner",
  "little-big-town",
  "exo",
  "jimin",
  "rose",
  "jay-z",
  "metallica",
  // anime titles used as folksonomy tags instead of the real genre — merged
  // into /estilo/anime
  "naruto",
  "one-piece",
  // Last.fm personal-list tags, not genres (no sensible redirect target — just excluded)
  "upcoming-album-2024",
  "scandinavian-girls-sweden",
  "lo-que-si-me-gusta-aunque-no-me-crean",
  "lesser-known-yet-streamable-artists",
  "im-strangely-attracted-to-these-people",
  "andy-i-love-you",
  "better-than-selena-gomez",
  "better-than-tarja",
  "cheating-at-solitaire",
  "desvalado-y-sin-amor",
  "everyone-high-fiving-everyone",
  "four-days-late",
  "i-know-what-its-to-be-young",
  "i-love-them",
  "impossible-for-liberals-to-deal-with",
  "love-love-love",
  "move-your-body",
  "music-i-might-like",
  "need-to-rate",
  "no-fuck-no",
  "not-post-rock",
  "over-twenty-minutes",
  "paradox-tilburg-2021",
  "pop-at-its-finest",
  "portland-fucking-oregon",
  "rock-and-fucking-roll",
  "shut-the-fuck-up",
  "similar-to-johnny-rebel",
  "spank-rock-and-benny-blanco",
  "spencer-krug-shits-on-british-techno",
  "the-voice-s21",
  "the-voice-s21-team-ariana",
  "the-voice-s21-team-legend",
  "the-voice-s22",
  "under-100-listeners",
  "under-2000-listeners",
  "under-900-plays",
  "upcoming-album-2022",
  "upcoming-album-2023",
  "will-and-grace",
  "worst-of-2010",
  "husband-and-wife",
  "eternity-and-beyond",
  "hanbin-da-lizii",
  "jazz-favorites-ram",
  "usa-us-american",
  "wood-and-string",
  "rock-de-barra",
  "spice-girls",
  "girl-group",
  // Performer-gender descriptors leaking in as if they were genres — like an
  // artist name, "female" describes who's performing, not a musical style.
  // "female fronted metal" and "girl groups" are kept: those are established,
  // musically coherent genre/scene terms, not bare demographic tags.
  "female-vocalist",
  "female",
  "female-voices",
  "female-vocal",
  "french-female",
  "female-singer-songwriters",
  "female-fronted",
  "female-country",
  "female-drummer",
  "female-jazz-contemporary",
  "female-rap",
  "female-artists",
  "female-vocals",
  "female-fronted-prog",
  "rockabilly-women",
  // More artist-name tags found via a full catalog x-match against Disco.artista —
  // thin (≤3 discs), so excluded outright with no redirect target.
  "ac-dc",
  "acdc",
  "alan-parsons",
  "alfred-drake",
  "ayumi-hamasaki",
  "b12",
  "babymonster",
  "backstreet-boys",
  "bigbang",
  "biggie",
  "big-bang",
  "billy-currington",
  "boston-pops",
  "bruce-hornsby",
  "buena-vista-social-club",
  "care-bears",
  "carlos-castaneda",
  "chayanne",
  "chico-buarque",
  "chris-ledoux",
  "claude-bolling",
  "clint-black",
  "damien-jurado",
  "deftones",
  "dierks-bentley",
  "don-williams",
  "donell-jones",
  "duran-duran",
  "electric-dust",
  "emilia-sisco",
  "faron-young",
  "fifth-harmony",
  "frank-turner",
  "garth-brooks",
  "gerald-levert",
  "gilberto-santa-rosa",
  "gold-city",
  "grateful-dead",
  "half-alive",
  "hector-lavoe",
  "jellyfish",
  "jennie",
  "jerry-garcia",
  "jessica-simpson",
  "jim-hall",
  "jo-dee-messina",
  "joe-diffie",
  "john-denver",
  "johnny-lee",
  "jose-jose",
  "jose-luis-perales",
  "josh-turner",
  "joy-division",
  "juan-gabriel",
  "julio-iglesias",
  "jung-kook",
  "justin-moore",
  "kate-bush",
  "kool-keith",
  "lana-del-rey",
  "lang-lang",
  "lee-brice",
  "les-compagnons-de-la-chanson",
  "lil-wyte",
  "loona",
  "lorrie-morgan",
  "los-terricolas",
  "lucki",
  "mac-davis",
  "madlib",
  "mandy-moore",
  "marcus-johnson",
  "martina-mcbride",
  "megadeth",
  "mia-martini",
  "mike-posner",
  "moby",
  "nct",
  "nick-carter",
  "nick-cave",
  "nightwish",
  "nofx",
  "omar-rodriguez-lopez",
  "p-nk",
  "patty-duke",
  "pet-shop-boys",
  "petula-clark",
  "philippe-entremont",
  "pink-floyd",
  "prodigy",
  "queens",
  "radiohead",
  "ramones",
  "red-garland",
  "renaissance",
  "rey-ruiz",
  "roger-williams",
  "rose",
  "roy-orbison",
  "rush",
  "russ-morgan",
  "sawyer-brown",
  "schubert",
  "selena-gomez",
  "shinee",
  "simone-hines",
  "slayer",
  "south-park-mexican",
  "stayc",
  "sugarland",
  "sweet-honey-in-the-rock",
  "taeyeon",
  "tamia",
  "terri-clark",
  "tessa-dare",
  "the-b-52-s",
  "the-beatles",
  "the-bellamy-brothers",
  "the-judds",
  "the-rolling-stones",
  "the-wanted",
  "the-zombies",
  "thomas-newman",
  "tom-smith",
  "tracy-lawrence",
  "travis-tritt",
  "twice",
  "van-halen",
  "vince-gill",
  "warda",
  "ween",
  "william-butler-yeats",
  "wonder-girls",
  "woodstock",
  "zac-brown-band",
  "zz-top",
  // Already redirected in next.config.ts but missing from this Set (out of
  // sync — Set drives getEstilosList/getRelatedEstilos, redirects drive the
  // HTTP 301; both need the slug or internal links keep pointing at a page
  // that just bounces).
  "blackpink",
  "chris-brown",
  "cortis",
  "fleetwood-mac",
  "ginuwine",
  "helloween",
  "hilary-duff",
  "keyshia-cole",
  "raspberry-bulbs",
  "ray-conniff",
  "tanya-tucker",
  // New artist-name leaks found via thin-tag (<=3 discs) x-match against
  // Disco.artista, 2026-07-18 pass. Paired next.config.ts redirects added.
  "bauhaus",
  "doctor-who",
  "future",
  "jim-hall",
  "middle-of-the-road",
  "queen",
  // Duplicate-meaning tags (singular/plural, pt/en) merged into the tag with
  // real inventory — user-reported, 2026-07-18. See matching next.config.ts redirects.
  "boyband",
  "brazil",
  // Decade tags — /decada pages are the canonical decade-browsing surface.
  "60s",
  "70s",
  "80s",
  "90s",
]);

function estiloOrderBy(sort: string): Prisma.Sql {
  switch (sort) {
    case "deals":       return Prisma.sql`c.deal_score DESC NULLS LAST, desconto DESC NULLS LAST`;
    case "menor-preco": return Prisma.sql`hp_latest.preco ASC`;
    case "maior-preco": return Prisma.sql`hp_latest.preco DESC`;
    case "avaliados":   return Prisma.sql`c.rating::float DESC NULLS LAST`;
    case "az":          return Prisma.sql`c.titulo ASC`;
    default:            return Prisma.sql`desconto DESC NULLS LAST`;
  }
}

export type SerializedEstiloData = {
  canonical: string;
  bioShortPt: string | null;
  bioPt: string | null;
  total: number;
  totalPages: number;
  discos: {
    id: string;
    titulo: string;
    artista: string;
    slug: string;
    imgUrl: string | null;
    url: string;
    marketplace: string;
    estilo: string | null;
    rating: string | null;
    reviewCount: number | null;
    precoAtual: number;
    mediaPreco: number;
    desconto: number;
    sparkline: number[];
    dealScore: number | null;
    confidenceLevel: string | null;
    lastCrawledAt: string | null;
  }[];
};

export type RelatedEstilo = { tag: string; slug: string };

const _getEstiloPageData = unstable_cache(
  async (
    slug: string,
    page: number,
    sort: string,
    precoMax: number | null,
    // Page render passes a large pageSize to fetch the style's top records in
    // one shot so sort/filter/pagination can run client-side (keeps the route
    // ISR-cacheable — no server searchParams). Defaults to ESTILO_PAGE_SIZE for
    // any legacy paginated caller.
    pageSize: number = ESTILO_PAGE_SIZE,
  ): Promise<SerializedEstiloData | null> => {
    // A record belongs to a style when EITHER source says so — see the OR on
    // discogs_styles in the queries below.
    //
    // lastfm_tags alone left the Discogs enrichment invisible to browsing: a
    // record could show "Indie Rock" on its own page and be missing from
    // /estilo/indie-rock. Matching both puts 5,797 records onto 267 style pages
    // they were absent from, and creates no page at all.
    //
    // Only MEMBERSHIP widens. The canonical lookup right below stays derived
    // from lastfm_tags, which is what makes new pages impossible: Discogs
    // carries 171 style names we have no page for, averaging ~11 records each,
    // and one page per term is how index bloat starts. A Discogs style with no
    // matching canonical simply never matches and is ignored.
    //
    // Compared on the lowercased string rather than the slug. Slug comparison
    // would also catch "post bop" against /estilo/post-bop, but that is 306 of
    // 15,388 pairs — 2% — and would put a regexp_replace on every row of a
    // query that already joins price history on each style page render.
    //
    // Never merged into lastfm_tags. That column was clobbered by an
    // enrichment bug once and 702 rows had to be restored; the two stay apart.
    const canonicalRow = await prisma.$queryRaw<{ tag: string }[]>`
      WITH tags AS (
        SELECT DISTINCT unnest(string_to_array(lastfm_tags, ', ')) AS tag
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
      )
      SELECT tag FROM tags
      WHERE regexp_replace(
              regexp_replace(
                translate(lower(tag), ${ACCENT_FROM}, ${ACCENT_TO}),
                '[^a-z0-9]+', '-', 'g'
              ),
              '^-+|-+$', '', 'g'
            ) = ${slug}
      LIMIT 1
    `;

    if (canonicalRow.length === 0) return null;
    const canonical = canonicalRow[0].tag;

    const wherePrecoMax =
      precoMax !== null && !isNaN(precoMax)
        ? Prisma.sql`AND hp_latest.preco <= ${precoMax}`
        : Prisma.sql``;

    const orderBy  = estiloOrderBy(sort);
    const offset   = (page - 1) * pageSize;

    const bioQuery = prisma.$queryRaw<{ bioShortPt: string | null; bioPt: string | null }[]>`
      SELECT bio_short_pt AS "bioShortPt", bio_pt AS "bioPt"
      FROM "EstiloMeta"
      WHERE tag = LOWER(${canonical})
      LIMIT 1
    `;

    const countQuery = prisma.$queryRaw<[{ total: bigint }]>`
      SELECT COUNT(*) AS total
      FROM "Disco" c
      INNER JOIN LATERAL (
        SELECT "precoBrl"::float AS preco
        FROM "HistoricoPreco"
        WHERE "discoId" = c.id
        ORDER BY "capturadoEm" DESC LIMIT 1
      ) hp_latest ON true
      WHERE (LOWER(${canonical}) = ANY(string_to_array(LOWER(c.lastfm_tags), ', '))
          OR LOWER(${canonical}) = ANY(string_to_array(LOWER(c.discogs_styles), ', ')))
        AND c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        ${wherePrecoMax}
    `;

    const mainQuery = prisma.$queryRaw<{
      id: string;
      titulo: string;
      artista: string;
      slug: string;
      imgUrl: string | null;
      url: string;
      marketplace: string;
      estilo: string | null;
      rating: string | null;
      reviewCount: string | null;
      dealScore: number | null;
      confidenceLevel: string | null;
      lastCrawledAt: Date | null;
      precoAtual: number;
      mediaPreco: number;
      desconto: number;
      sparkline: unknown;
    }[]>`
      SELECT
        c.id,
        c.titulo,
        c.artista,
        c.slug,
        c."imgUrl",
        c.url,
        c.marketplace,
        c.estilo,
        c.rating::text,
        c."reviewCount",
        c.deal_score       AS "dealScore",
        c.confidence_level AS "confidenceLevel",
        c.last_crawled_at  AS "lastCrawledAt",
        hp_latest.preco                                        AS "precoAtual",
        COALESCE(c.avg_30d::float, hp_latest.preco)           AS "mediaPreco",
        CASE
          WHEN COALESCE(c.avg_30d::float, 0) > 0
          THEN (COALESCE(c.avg_30d::float, hp_latest.preco) - hp_latest.preco)
               / COALESCE(c.avg_30d::float, hp_latest.preco)
          ELSE 0
        END AS desconto,
        (
          SELECT COALESCE(
            json_agg(sp."precoBrl"::float ORDER BY sp."capturadoEm"),
            '[]'::json
          )
          FROM (
            SELECT "precoBrl", "capturadoEm"
            FROM "HistoricoPreco"
            WHERE "discoId" = c.id
              AND "capturadoEm" >= NOW() - INTERVAL '30 days'
            ORDER BY "capturadoEm" ASC
            LIMIT 10
          ) sp
        ) AS sparkline
      FROM "Disco" c
      INNER JOIN LATERAL (
        SELECT "precoBrl"::float AS preco
        FROM "HistoricoPreco"
        WHERE "discoId" = c.id
        ORDER BY "capturadoEm" DESC LIMIT 1
      ) hp_latest ON true
      WHERE (LOWER(${canonical}) = ANY(string_to_array(LOWER(c.lastfm_tags), ', '))
          OR LOWER(${canonical}) = ANY(string_to_array(LOWER(c.discogs_styles), ', ')))
        AND c.disponivel = TRUE
        AND (c.format IS NULL OR c.format = 'vinyl')
        AND c.price_count >= 5
        ${wherePrecoMax}
      ORDER BY ${orderBy}
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    const [bioRows, countResult, rows] = await Promise.all([bioQuery, countQuery, mainQuery]);

    const bio   = bioRows[0] ?? null;
    const total = Number(countResult[0].total);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      canonical,
      bioShortPt:  bio?.bioShortPt ?? null,
      bioPt:       bio?.bioPt ?? null,
      total,
      totalPages,
      discos: rows.map((row) => {
        let sparkline: number[] = [];
        if (Array.isArray(row.sparkline)) {
          sparkline = (row.sparkline as unknown[]).map(Number).filter((n) => !isNaN(n));
        } else if (typeof row.sparkline === "string") {
          try {
            sparkline = (JSON.parse(row.sparkline) as unknown[])
              .map(Number)
              .filter((n) => !isNaN(n));
          } catch {
            sparkline = [];
          }
        }
        return {
          id: row.id,
          titulo: row.titulo,
          artista: row.artista,
          slug: row.slug,
          imgUrl: row.imgUrl,
          url: row.url,
          marketplace: row.marketplace,
          estilo: row.estilo,
          rating: row.rating ?? null,
          reviewCount: row.reviewCount !== null ? Number(row.reviewCount) : null,
          precoAtual: Number(row.precoAtual),
          mediaPreco: Number(row.mediaPreco),
          desconto: Number(row.desconto),
          sparkline,
          dealScore:
            row.dealScore !== null && row.dealScore !== undefined
              ? Number(row.dealScore)
              : null,
          confidenceLevel: row.confidenceLevel ?? null,
          lastCrawledAt: row.lastCrawledAt
            ? new Date(row.lastCrawledAt).toISOString()
            : null,
        };
      }),
    };
  },
  ["estilo-page"],
  { tags: ["prices"], revalidate: 14400 }
);

export const getEstiloPageData = cache(_getEstiloPageData);

const _getRelatedEstilos = unstable_cache(
  async (canonical: string): Promise<RelatedEstilo[]> => {
    const rows = await prisma.$queryRaw<{ tag: string }[]>`
      WITH current_discos AS (
        SELECT id FROM "Disco"
        WHERE disponivel = TRUE
        AND  (format IS NULL OR format = 'vinyl')
          AND (LOWER(${canonical}) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
            OR LOWER(${canonical}) = ANY(string_to_array(LOWER(discogs_styles), ', ')))
      ),
      all_tags AS (
        SELECT tag, COUNT(DISTINCT id)::float AS total
        FROM (
          SELECT id, LOWER(unnest(string_to_array(lastfm_tags, ', '))) AS tag
          FROM "Disco"
          WHERE disponivel = TRUE
          AND  (format IS NULL OR format = 'vinyl')
        ) t
        GROUP BY tag
      ),
      shared_tags AS (
        SELECT tag, COUNT(DISTINCT id)::float AS shared
        FROM (
          SELECT d.id, LOWER(unnest(string_to_array(d.lastfm_tags, ', '))) AS tag
          FROM "Disco" d
          INNER JOIN current_discos cd ON cd.id = d.id
          WHERE d.disponivel = TRUE
          AND  (d.format IS NULL OR d.format = 'vinyl')
        ) t
        GROUP BY tag
      ),
      current_size AS (SELECT COUNT(*)::float AS cnt FROM current_discos)
      SELECT s.tag
      FROM shared_tags s
      JOIN all_tags a ON a.tag = s.tag
      CROSS JOIN current_size cs
      WHERE s.tag != LOWER(${canonical})
        AND s.shared > 0
      ORDER BY s.shared / (cs.cnt + a.total - s.shared) DESC
      LIMIT 10
    `;
    return rows
      .map((r) => ({ tag: r.tag, slug: slugifyStyle(r.tag) }))
      .filter((r) => !REDIRECTED_ESTILO_SLUGS.has(r.slug) && !COUNTRY_TAG_TO_PAIS_SLUG[r.slug]);
  },
  ["estilo-related"],
  { tags: ["prices"], revalidate: 14400 }
);

export const getRelatedEstilos = cache(_getRelatedEstilos);

export type TopArtistForEstilo = { artista: string; slug: string; discoCount: number };

const _getTopArtistsForEstilo = unstable_cache(
  async (canonical: string): Promise<TopArtistForEstilo[]> => {
    const rows = await prisma.$queryRaw<{ artista: string; disco_count: bigint }[]>`
      SELECT artista, COUNT(*) AS disco_count
      FROM "Disco"
      WHERE (LOWER(${canonical}) = ANY(string_to_array(LOWER(lastfm_tags), ', '))
          OR LOWER(${canonical}) = ANY(string_to_array(LOWER(discogs_styles), ', ')))
        AND disponivel = TRUE
        AND (format IS NULL OR format = 'vinyl')
        AND price_count >= 5
      GROUP BY artista
      ORDER BY disco_count DESC
      LIMIT 8
    `;
    return rows.map((r) => ({
      artista: r.artista,
      slug: slugifyArtist(r.artista),
      discoCount: Number(r.disco_count),
    }));
  },
  ["estilo-top-artists"],
  { tags: ["prices"], revalidate: 14400 }
);

export const getTopArtistsForEstilo = cache(_getTopArtistsForEstilo);

export type EstiloListItem = { tag: string; slug: string; discoCount: number };

const _getEstilosList = unstable_cache(
  async (): Promise<EstiloListItem[]> => {
    const rows = await prisma.$queryRaw<{ tag: string; disco_count: bigint }[]>`
      WITH vocab AS (
        -- The vocabulary stays Last.fm's. A Discogs style only counts when a
        -- page for it already exists, so this index can never gain a row that
        -- /estilo/<slug> would 404 on.
        SELECT DISTINCT LOWER(unnest(string_to_array(lastfm_tags, ', '))) AS tag
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
      ),
      pairs AS (
        SELECT LOWER(unnest(string_to_array(lastfm_tags, ', '))) AS tag, id
        FROM "Disco"
        WHERE lastfm_tags IS NOT NULL AND lastfm_tags != ''
          AND disponivel = TRUE
          AND (format IS NULL OR format = 'vinyl')
          AND price_count >= 5
        UNION
        SELECT LOWER(st.tag), d.id
        FROM "Disco" d,
             unnest(string_to_array(d.discogs_styles, ', ')) AS st(tag)
        WHERE d.discogs_styles IS NOT NULL AND d.discogs_styles != ''
          AND d.disponivel = TRUE
          AND (d.format IS NULL OR d.format = 'vinyl')
          AND d.price_count >= 5
          AND LOWER(st.tag) IN (SELECT tag FROM vocab)
      )
      -- Grouped on the lowered tag so "Indie Rock" and "indie rock" are one
      -- row. They slugify identically, and the previous version counted them
      -- separately and then dropped the smaller of the two.
      SELECT tag, COUNT(DISTINCT id) AS disco_count
      FROM pairs
      GROUP BY tag
      HAVING COUNT(DISTINCT id) > 3
      ORDER BY COUNT(DISTINCT id) DESC
    `;
    const seenSlugs = new Set<string>();
    const result: EstiloListItem[] = [];
    for (const r of rows) {
      const slug = slugifyStyle(r.tag);
      if (!slug || seenSlugs.has(slug) || REDIRECTED_ESTILO_SLUGS.has(slug) || COUNTRY_TAG_TO_PAIS_SLUG[slug]) continue;
      seenSlugs.add(slug);
      result.push({ tag: r.tag, slug, discoCount: Number(r.disco_count) });
    }
    return result;
  },
  ["estilos-list"],
  { tags: ["prices"], revalidate: 14400 }
);

export const getEstilosList = cache(_getEstilosList);
