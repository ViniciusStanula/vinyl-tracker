import { prisma } from "./prisma";
import type { ProcessedDisco } from "@/lib/queryDiscos";
import { unstable_cache } from "next/cache";

type BfRow = {
  id: string;
  titulo: string;
  tituloSeo: string | null;
  artista: string;
  slug: string;
  estilo: string | null;
  imgUrl: string | null;
  url: string;
  marketplace: string;
  rating: string | null;
  reviewCount: string | null;
  lastfmTags: string | null;
  precoAtual: string;
  baseline: string;
  lowAllTime: string | null;
};

/** Below this, a "discount" is price jitter, not Black Friday. */
const MIN_DESCONTO = 0.1;

/** Same tolerance as crawler/bot.py ATL_TOLERANCE: prices jitter by cents. */
const ATL_TOLERANCE = 1.005;

/**
 * Available vinyls priced at least 10% under their Black Friday reference —
 * the median price over baselineWindow() (lib/blackFriday.ts), materialized in
 * bf_baseline by crawler/bf_baseline.py. Biggest real discount first.
 *
 * ArtistaRecords receives the whole list but renders 24 cards at a time, so
 * each row costs only its JSON in the payload, not card HTML (what made
 * /ofertas 3.4 MB). The cap keeps the cached result under unstable_cache's
 * 2 MB item limit.
 */
export async function queryBlackFriday(year: number): Promise<ProcessedDisco[]> {
  try {
    const rows = await prisma.$queryRaw<BfRow[]>`
      SELECT
        d.id,
        d.titulo,
        d.titulo_seo                AS "tituloSeo",
        d.artista,
        d.slug,
        d.estilo,
        d."imgUrl",
        d.url,
        d.marketplace,
        d.rating::text              AS rating,
        d."reviewCount"::text       AS "reviewCount",
        d.lastfm_tags               AS "lastfmTags",
        hp_latest."precoBrl"::text  AS "precoAtual",
        b.baseline::text            AS baseline,
        d.low_all_time::text        AS "lowAllTime"
      FROM   bf_baseline b
      JOIN   "Disco" d ON d.id = b.disco_id
      INNER JOIN LATERAL (
        SELECT "precoBrl"
        FROM   "HistoricoPreco"
        WHERE  "discoId" = d.id
        ORDER  BY "capturadoEm" DESC
        LIMIT  1
      ) hp_latest ON true
      WHERE  b.year = ${year}
        AND  d.disponivel = TRUE
        AND  (d.format IS NULL OR d.format = 'vinyl')
        AND  d.price_count >= 5
        AND  hp_latest."precoBrl" >= 30
        AND  hp_latest."precoBrl" <= b.baseline * ${1 - MIN_DESCONTO}
      ORDER  BY (b.baseline - hp_latest."precoBrl") / b.baseline DESC, d.id
      LIMIT  1000
    `;

    return rows.map((row) => {
      const precoAtual = Number(row.precoAtual);
      const baseline   = Number(row.baseline);
      return {
        id:          row.id,
        slug:        row.slug,
        titulo:      row.titulo,
        tituloSeo:   row.tituloSeo,
        artista:     row.artista,
        estilo:      row.estilo,
        imgUrl:      row.imgUrl,
        url:         row.url,
        marketplace: row.marketplace,
        rating:      row.rating != null ? Number(row.rating) : null,
        reviewCount: row.reviewCount != null ? Number(row.reviewCount) : null,
        precoAtual,
        // DiscoCard strikes through mediaPreco next to the -% badge, so here it
        // is the pre-Black-Friday reference the discount is measured against.
        mediaPreco:  baseline,
        desconto:    (baseline - precoAtual) / baseline,
        sparkline:   [],
        // Tier badges are scored against avg_30d — a different yardstick from
        // this page's. Showing both would contradict each other on some cards.
        dealScore:   null,
        lastfmTags:  row.lastfmTags,
        menorPreco:  row.lowAllTime != null && precoAtual <= Number(row.lowAllTime) * ATL_TOLERANCE,
      };
    });
  } catch {
    return [];
  }
}

// `prices` tag: the crawler webhook invalidates it after each run.
export const queryBlackFridayWithCache = unstable_cache(
  queryBlackFriday,
  ["black-friday"],
  { tags: ["prices"], revalidate: 14400 },
);
